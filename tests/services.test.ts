import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DB } from "@/db";
import { bookmarks, digests, events, users, type User } from "@/db/schema";
import { ARTICLE_HTML, freshDb } from "./helpers";

// Cookie jar standing in for next/headers in route-less tests.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => (value ? jar.set(name, value) : jar.delete(name)),
  }),
}));

const { changePassword, deleteAccount, exportAccount, updateSettings } = await import("@/server/account");
const { adminListEvents, adminListUsers, adminMetrics, adminUpdateUser } = await import("@/server/admin");
const auth = await import("@/server/auth");
const bm = await import("@/server/bookmarks");
const dg = await import("@/server/digests");
const { rateLimit, enforceRateLimit } = await import("@/server/rate-limit");
const { extractFromHtml } = await import("@/lib/extract");

const COST = 4;
const fakeExtract = async (url: string) => extractFromHtml(ARTICLE_HTML, url);
const failingExtract = async () => {
  throw new Error("HTTP 500");
};

let db: DB;
let alice: User;
let bob: User;

beforeAll(async () => {
  db = await freshDb();
  process.env.ADMIN_EMAILS = "admin@digestbot.test";
  delete process.env.GEMINI_API_KEY;
  delete process.env.RESEND_API_KEY;
  alice = await auth.signup({ name: "Alice", email: "Alice@Example.com", password: "password1" }, COST);
  bob = await auth.signup({ name: "Bob", email: "bob@example.com", password: "password2" }, COST);
});

describe("auth service", () => {
  it("stores bcrypt hashes and lower-cased emails", async () => {
    expect(alice.email).toBe("alice@example.com");
    expect(alice.passwordHash).toMatch(/^\$2/);
    expect(alice.passwordHash).not.toContain("password1");
    expect(alice.role).toBe("user");
  });
  it("rejects duplicate emails", async () => {
    await expect(auth.signup({ name: "A2", email: "alice@example.com", password: "password1" }, COST)).rejects.toMatchObject({ status: 409 });
  });
  it("grants admin to configured emails", async () => {
    const admin = await auth.signup({ name: "Admin", email: "admin@digestbot.test", password: "password9" }, COST);
    expect(admin.role).toBe("admin");
  });
  it("logs in with correct credentials only", async () => {
    expect((await auth.login({ email: "ALICE@example.com", password: "password1" }, COST)).id).toBe(alice.id);
    await expect(auth.login({ email: "alice@example.com", password: "nope" }, COST)).rejects.toMatchObject({ status: 401 });
    await expect(auth.login({ email: "ghost@example.com", password: "whatever1" }, COST)).rejects.toMatchObject({ status: 401 });
  });
  it("issues a session cookie that resolves to the user, and clears it", async () => {
    await auth.startSession(alice);
    expect((await auth.currentUser())?.id).toBe(alice.id);
    expect((await auth.requireUser()).id).toBe(alice.id);
    await expect(auth.requireAdmin()).rejects.toMatchObject({ status: 403 });
    await auth.endSession();
    expect(await auth.currentUser()).toBeNull();
    await expect(auth.requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("serialises users without the password hash", () => {
    expect(JSON.stringify(auth.publicUser(alice))).not.toContain("$2");
  });
});

describe("bookmark service", () => {
  it("creates, normalises and de-duplicates bookmarks", async () => {
    const first = await bm.createBookmark(alice, { url: "eng.example.com/postgres?utm_source=tw" });
    expect(first.duplicate).toBe(false);
    expect(first.bookmark.url).toBe("https://eng.example.com/postgres");
    expect(first.bookmark.summarySource).toBe("pending");
    const again = await bm.createBookmark(alice, { url: "https://ENG.example.com/postgres/#x" });
    expect(again.duplicate).toBe(true);
    expect(again.bookmark.id).toBe(first.bookmark.id);
    // same URL for another user is a separate bookmark (multi-tenant)
    expect((await bm.createBookmark(bob, { url: "https://eng.example.com/postgres" })).duplicate).toBe(false);
  });

  it("rejects unsafe URLs", async () => {
    await expect(bm.createBookmark(alice, { url: "javascript:alert(1)" })).rejects.toThrow();
    await expect(bm.createBookmark(alice, { url: "" })).rejects.toThrow();
  });

  it("processes pending bookmarks with the extractive engine when AI is off", async () => {
    const n = await bm.processPending({ userId: alice.id, limit: 10, deps: { extract: fakeExtract, ai: {} } });
    expect(n).toBe(1);
    const { items } = await bm.listBookmarks(alice, {});
    const b = items[0];
    expect(b.summarySource).toBe("extractive");
    expect(b.title).toBe("A practical guide to Postgres indexes");
    expect(b.topic).toBe("Data & Databases");
    expect(b.summary).toMatch(/index/i);
    expect(b.keyPoints.length).toBeGreaterThan(0);
    expect(b.siteName).toBe("Example Engineering");
  });

  it("uses AI output when Gemini is configured", async () => {
    const { bookmark } = await bm.createBookmark(alice, { url: "https://ai.example.com/agents" });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ summary: "Agents explained clearly.", keyPoints: ["a", "b", "c"], topic: "AI & Machine Learning", tags: ["agents"], worthFullRead: true }) }] } },
          ],
        }),
      ),
    );
    const b = await bm.processBookmark(bookmark.id, { extract: fakeExtract, ai: { apiKey: "k", fetchImpl } });
    expect(b?.summarySource).toBe("ai");
    expect(b?.topic).toBe("AI & Machine Learning");
    expect(b?.priority).toBe(1);
  });

  it("falls back to extractive when AI fails, and marks fetch failures", async () => {
    const { bookmark } = await bm.createBookmark(alice, { url: "https://flaky.example.com/a" });
    const ai = { apiKey: "k", fetchImpl: vi.fn().mockResolvedValue(new Response("", { status: 503 })) };
    expect((await bm.processBookmark(bookmark.id, { extract: fakeExtract, ai }))?.summarySource).toBe("extractive");

    const { bookmark: broken } = await bm.createBookmark(alice, { url: "https://down.example.com/" });
    const failed = await bm.processBookmark(broken.id, { extract: failingExtract, ai: {} });
    expect(failed?.summarySource).toBe("failed");
    expect(failed?.error).toMatch(/HTTP 500/);
    expect(await bm.processBookmark("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("searches, filters by topic/status and paginates", async () => {
    expect((await bm.listBookmarks(alice, { q: "agents" })).items.map((b) => b.url)).toEqual(["https://ai.example.com/agents"]);
    expect((await bm.listBookmarks(alice, { q: "100%_" })).total).toBe(0);
    expect((await bm.listBookmarks(alice, { topic: "Data & Databases" })).items.every((b) => b.topic === "Data & Databases")).toBe(true);
    const page = await bm.listBookmarks(alice, { pageSize: 2, page: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(4);
    expect(page.topics.length).toBeGreaterThan(0);
    const stats = await bm.bookmarkStats(alice);
    expect(stats.total).toBe(4);
    expect(stats.unread).toBe(4);
  });

  it("isolates tenants: Bob cannot see or change Alice's bookmarks", async () => {
    const { items } = await bm.listBookmarks(alice, {});
    const id = items[0].id;
    expect((await bm.listBookmarks(bob, {})).items.some((b) => b.id === id)).toBe(false);
    await expect(bm.getBookmark(bob, id)).rejects.toMatchObject({ status: 404 });
    await expect(bm.updateBookmark(bob, id, { status: "read" })).rejects.toMatchObject({ status: 404 });
    await expect(bm.deleteBookmark(bob, id)).rejects.toMatchObject({ status: 404 });
    expect(await bm.batchBookmarks(bob, { ids: [id], action: "delete" })).toBe(0);
    await expect(bm.getBookmark(alice, "not-a-uuid")).rejects.toMatchObject({ status: 404 });
  });

  it("updates status, archives via batch, and deletes", async () => {
    const { items } = await bm.listBookmarks(alice, {});
    const read = await bm.updateBookmark(alice, items[0].id, { status: "read" });
    expect(read.readAt).toBeInstanceOf(Date);
    const unread = await bm.updateBookmark(alice, items[0].id, { status: "unread" });
    expect(unread.readAt).toBeNull();
    await expect(bm.updateBookmark(alice, items[0].id, {})).rejects.toThrow();
    expect(await bm.batchBookmarks(alice, { ids: [items[1].id], action: "archive" })).toBe(1);
    expect((await bm.listBookmarks(alice, {})).total).toBe(3);
    expect((await bm.listBookmarks(alice, { status: "archived" })).total).toBe(1);
    expect(await bm.batchBookmarks(alice, { ids: [items[1].id], action: "unread" })).toBe(1);
    expect(await bm.batchBookmarks(alice, { ids: [items[1].id], action: "read" })).toBe(1);
    await bm.resetForResummarize(alice, items[2].id);
    expect((await bm.getBookmark(alice, items[2].id)).summarySource).toBe("pending");
    await bm.processPending({ limit: 5, deps: { extract: fakeExtract, ai: {} } });
  });

  it("imports a browser bookmarks file", async () => {
    const html = `<DL><DT><A HREF="https://one.example.com/">One</A><DT><A HREF="https://ai.example.com/agents">dupe</A><DT><A HREF="http://bad">bad</A></DL>`;
    // "http://bad" has no public hostname, so it is skipped
    expect(await bm.importBookmarks(bob, html)).toEqual({ imported: 2, duplicates: 0, skipped: 1 });
    expect(await bm.importBookmarks(bob, html)).toEqual({ imported: 0, duplicates: 2, skipped: 1 });
    await expect(bm.importBookmarks(bob, "<p>nothing</p>")).rejects.toMatchObject({ status: 400 });
  });

  it("runs with bounded concurrency", async () => {
    let active = 0;
    let peak = 0;
    await bm.mapLimit([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(peak).toBe(2);
  });
});

describe("digest service", () => {
  let digestId: string;

  it("generates a digest from the last 7 days", async () => {
    const d = await dg.generateDigest(alice, { days: 7 }, { ai: {} });
    digestId = d.id;
    expect(d.itemCount).toBe(4);
    expect(d.intro).toMatch(/^This week you saved 4 links/);
    expect(d.content.sections.length).toBeGreaterThan(0);
    const items = await db.select().from((await import("@/db/schema")).digestItems);
    expect(items.filter((i) => i.digestId === d.id)).toHaveLength(4);
  });

  it("returns 422 when there is nothing to digest", async () => {
    const carol = await auth.signup({ name: "Carol", email: "carol@example.com", password: "password3" }, COST);
    await expect(dg.generateDigest(carol, {}, { ai: {} })).rejects.toMatchObject({ status: 422 });
  });

  it("uses an AI intro when available", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ intro: "A week of databases and agents for you." }) }] } }] })),
    );
    const d = await dg.generateDigest(alice, {}, { ai: { apiKey: "k", fetchImpl } });
    expect(d.intro).toBe("A week of databases and agents for you.");
    await dg.deleteDigest(alice, d.id);
  });

  it("lists, gets and isolates digests", async () => {
    expect((await dg.listDigests(alice)).map((d) => d.id)).toEqual([digestId]);
    expect(await dg.listDigests(bob)).toHaveLength(0);
    await expect(dg.getDigest(bob, digestId)).rejects.toMatchObject({ status: 404 });
    await expect(dg.getDigest(alice, "x")).rejects.toMatchObject({ status: 404 });
  });

  it("shares via an unguessable token and revokes it", async () => {
    const shared = await dg.setDigestShared(alice, digestId, { shared: true });
    expect(shared.shareToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const dto = dg.serializeDigest(shared, "https://app.test");
    expect(dto.shareUrl).toBe(`https://app.test/d/${shared.shareToken}`);
    expect((await dg.getSharedDigest(shared.shareToken!))?.ownerName).toBe("Alice");
    expect(await dg.getSharedDigest("short")).toBeNull();
    const again = await dg.setDigestShared(alice, digestId, { shared: true });
    expect(again.shareToken).toBe(shared.shareToken);
    await dg.setDigestShared(alice, digestId, { shared: false });
    expect(await dg.getSharedDigest(shared.shareToken!)).toBeNull();
  });

  it("refuses to email when delivery is not configured, and sends via Resend when it is", async () => {
    const d = await dg.getDigest(alice, digestId);
    await expect(dg.emailDigest(alice, d, "https://app.test")).rejects.toMatchObject({ status: 503 });
    process.env.RESEND_API_KEY = "re_test";
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}"));
    const sent = await dg.emailDigest(alice, d, "https://app.test", fetchImpl);
    expect(sent.emailedAt).toBeInstanceOf(Date);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.to).toEqual(["alice@example.com"]);
    expect(body.html).toContain("Open in DigestBot");
    delete process.env.RESEND_API_KEY;
  });

  it("daily job builds digests only for users due today without a recent digest", async () => {
    const now = new Date();
    await db.update(users).set({ digestWeekday: now.getUTCDay() });
    const r = await dg.runDailyJob({ now, baseUrl: "https://app.test", processLimit: 0 });
    // Alice already has one this week; Bob has bookmarks and gets one; Carol/admin have none
    expect(r.digests).toBe(1);
    expect(r.emailed).toBe(0);
    expect(await dg.listDigests(bob)).toHaveLength(1);
    const again = await dg.runDailyJob({ now, baseUrl: "https://app.test", processLimit: 0 });
    expect(again.digests).toBe(0);
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window, then blocks", async () => {
    for (let i = 0; i < 3; i++) expect((await rateLimit("t:key", 3, 60)).ok).toBe(true);
    expect((await rateLimit("t:key", 3, 60)).ok).toBe(false);
    await expect(enforceRateLimit("t:key", 3, 60)).rejects.toMatchObject({ status: 429 });
  });
  it("resets after the window", async () => {
    await rateLimit("t:short", 1, 1);
    await db.execute(`update rate_limits set window_start = now() - interval '5 seconds' where key = 't:short'` as never);
    expect((await rateLimit("t:short", 1, 1)).ok).toBe(true);
  });
});

describe("admin service", () => {
  it("reports metrics with 30 daily points", async () => {
    const m = await adminMetrics();
    expect(m.totals.users).toBe(4);
    expect(m.totals.bookmarks).toBeGreaterThan(4);
    expect(m.daily).toHaveLength(30);
    expect(m.daily.at(-1)!.bookmarks).toBeGreaterThan(0);
    expect(m.summarySources.length).toBeGreaterThan(0);
  });

  it("lists and searches users", async () => {
    expect((await adminListUsers({})).total).toBe(4);
    const r = await adminListUsers({ q: "bob" });
    expect(r.items.map((u) => u.email)).toEqual(["bob@example.com"]);
    expect(r.items[0].bookmarks).toBe(3);
    expect(r.items[0].digests).toBe(1);
  });

  it("suspends users, which blocks login and sessions; admins cannot change themselves", async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@digestbot.test"));
    await expect(adminUpdateUser(admin, admin.id, { role: "user" })).rejects.toMatchObject({ status: 400 });
    await expect(adminUpdateUser(admin, "00000000-0000-0000-0000-000000000000", { status: "suspended" })).rejects.toMatchObject({ status: 404 });
    await auth.startSession(bob);
    expect((await auth.currentUser())?.id).toBe(bob.id);
    await adminUpdateUser(admin, bob.id, { status: "suspended" });
    expect(await auth.currentUser()).toBeNull();
    await expect(auth.login({ email: "bob@example.com", password: "password2" }, COST)).rejects.toMatchObject({ status: 403 });
    await adminUpdateUser(admin, bob.id, { status: "active", role: "admin" });
    expect((await auth.login({ email: "bob@example.com", password: "password2" }, COST)).role).toBe("admin");
  });

  it("records an audit trail", async () => {
    const all = await adminListEvents({});
    expect(all.total).toBeGreaterThan(5);
    const adminEvents = await adminListEvents({ type: "admin." });
    expect(adminEvents.items.every((e) => e.type.startsWith("admin."))).toBe(true);
    expect(adminEvents.items.map((e) => e.type)).toContain("admin.user_suspended");
    const failed = await db.select().from(events).where(eq(events.type, "auth.login_failed"));
    expect(failed.length).toBeGreaterThan(0);
  });
});

describe("account service", () => {
  it("updates settings", async () => {
    const u = await updateSettings(alice, { digestWeekday: 3, emailDigest: false, name: "Alice B" });
    expect([u.digestWeekday, u.emailDigest, u.name]).toEqual([3, false, "Alice B"]);
    await expect(updateSettings(alice, { digestWeekday: 9 })).rejects.toThrow();
  });

  it("changes password only with the current one", async () => {
    await expect(changePassword(alice, { currentPassword: "wrong", newPassword: "newpass123" }, COST)).rejects.toMatchObject({ status: 401 });
    await changePassword(alice, { currentPassword: "password1", newPassword: "newpass123" }, COST);
    expect((await auth.login({ email: "alice@example.com", password: "newpass123" }, COST)).id).toBe(alice.id);
  });

  it("exports data without secrets", async () => {
    const data = await exportAccount(alice);
    expect(data.bookmarks.length).toBe(4);
    expect(data.digests.length).toBe(1);
    expect(JSON.stringify(data)).not.toContain("$2");
  });

  it("deletes the account with cascade", async () => {
    const [fresh] = await db.select().from(users).where(eq(users.id, alice.id));
    await expect(deleteAccount(fresh, { password: "nope" })).rejects.toMatchObject({ status: 401 });
    await deleteAccount(fresh, { password: "newpass123" });
    expect(await db.select().from(bookmarks).where(eq(bookmarks.userId, alice.id))).toHaveLength(0);
    expect(await db.select().from(digests).where(eq(digests.userId, alice.id))).toHaveLength(0);
  });
});
