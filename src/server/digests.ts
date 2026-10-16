import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookmarks, type Digest, digestItems, digests, type User, users } from "@/db/schema";
import { type AiConfig, aiConfigFromEnv, digestIntroWithAi } from "@/lib/ai";
import { buildDigest, periodEnding, renderDigestEmail } from "@/lib/digest";
import { createDigestSchema, shareDigestSchema, uuidSchema } from "@/lib/validation";
import { processPending } from "./bookmarks";
import { emailEnabled, sendEmail } from "./email";
import { logEvent } from "./events";
import { ApiError, notFound } from "./http";

export function serializeDigest(d: Digest, baseUrl: string) {
  return {
    id: d.id,
    title: d.title,
    intro: d.intro,
    periodStart: d.periodStart,
    periodEnd: d.periodEnd,
    itemCount: d.itemCount,
    shared: Boolean(d.shareToken),
    shareUrl: d.shareToken ? `${baseUrl}/d/${d.shareToken}` : null,
    emailedAt: d.emailedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    content: d.content,
  };
}
export type DigestDTO = ReturnType<typeof serializeDigest>;

export async function generateDigest(user: User, input: unknown = {}, opts: { now?: Date; ai?: AiConfig } = {}): Promise<Digest> {
  const { days } = createDigestSchema.parse(input);
  const now = opts.now ?? new Date();
  const period = periodEnding(now, days);
  const db = await getDb();
  const rows = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, user.id), gte(bookmarks.createdAt, period.start), sql`${bookmarks.status} <> 'archived'`))
    .orderBy(desc(bookmarks.createdAt))
    .limit(500);
  const built = buildDigest(rows, period);
  if (!built) throw new ApiError(422, "nothing_to_digest", `Nothing to digest yet — save some links in the last ${days} days first.`);

  let intro = built.intro;
  const ai = opts.ai ?? aiConfigFromEnv();
  if (ai.apiKey) {
    try {
      intro = await digestIntroWithAi(ai, {
        items: built.content.sections.flatMap((s) => s.items),
        readingMinutes: built.content.stats.readingMinutes,
        digestMinutes: built.content.stats.digestMinutes,
      });
    } catch {
      /* keep template intro */
    }
  }

  const [digest] = await db
    .insert(digests)
    .values({
      userId: user.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      title: built.title,
      intro,
      content: built.content,
      itemCount: built.content.stats.items,
    })
    .returning();
  await db.insert(digestItems).values(built.itemIds.map((bookmarkId, position) => ({ digestId: digest.id, bookmarkId, position })));
  await logEvent("digest.created", user.id, { items: digest.itemCount });
  return digest;
}

export async function listDigests(user: User) {
  const db = await getDb();
  return db.select().from(digests).where(eq(digests.userId, user.id)).orderBy(desc(digests.createdAt)).limit(100);
}

export async function getDigest(user: User, id: string): Promise<Digest> {
  if (!uuidSchema.safeParse(id).success) throw notFound("Digest not found.");
  const db = await getDb();
  const [d] = await db
    .select()
    .from(digests)
    .where(and(eq(digests.id, id), eq(digests.userId, user.id)))
    .limit(1);
  if (!d) throw notFound("Digest not found.");
  return d;
}

export async function setDigestShared(user: User, id: string, input: unknown): Promise<Digest> {
  const { shared } = shareDigestSchema.parse(input);
  const current = await getDigest(user, id);
  const db = await getDb();
  const shareToken = shared ? (current.shareToken ?? randomBytes(24).toString("base64url")) : null;
  const [d] = await db.update(digests).set({ shareToken }).where(eq(digests.id, id)).returning();
  await logEvent(shared ? "digest.shared" : "digest.unshared", user.id);
  return d;
}

export async function deleteDigest(user: User, id: string) {
  await getDigest(user, id);
  const db = await getDb();
  await db.delete(digests).where(and(eq(digests.id, id), eq(digests.userId, user.id)));
}

export async function getSharedDigest(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ digest: digests, ownerName: users.name })
    .from(digests)
    .innerJoin(users, eq(users.id, digests.userId))
    .where(and(eq(digests.shareToken, token), eq(users.status, "active")))
    .limit(1);
  return row ?? null;
}

export async function emailDigest(user: User, digest: Digest, baseUrl: string, fetchImpl?: typeof fetch) {
  if (!emailEnabled()) throw new ApiError(503, "email_disabled", "Email delivery isn't configured on this server yet.");
  const html = renderDigestEmail(digest, `${baseUrl}/app/digests/${digest.id}`);
  await sendEmail({ to: user.email, subject: digest.title, html }, fetchImpl);
  const db = await getDb();
  const [d] = await db.update(digests).set({ emailedAt: new Date() }).where(eq(digests.id, digest.id)).returning();
  await logEvent("digest.emailed", user.id);
  return d;
}

/**
 * Daily scheduler job (Vercel Hobby allows one cron per day): process the
 * summary backlog, then build digests for users whose weekday is today and who
 * haven't had one in the last 6 days.
 */
export async function runDailyJob(opts: { now?: Date; baseUrl: string; processLimit?: number }) {
  const now = opts.now ?? new Date();
  const processed = await processPending({ limit: opts.processLimit ?? 25 });
  const db = await getDb();
  const due = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.status, "active"),
        eq(users.digestWeekday, now.getUTCDay()),
        sql`not exists (select 1 from ${digests} d where d.user_id = "users"."id" and d.created_at > ${new Date(now.getTime() - 6 * 864e5).toISOString()}::timestamptz)`,
      ),
    )
    .limit(200);

  let created = 0;
  let emailed = 0;
  for (const user of due) {
    try {
      const digest = await generateDigest(user, { days: 7 }, { now });
      created++;
      if (user.emailDigest && emailEnabled()) {
        await emailDigest(user, digest, opts.baseUrl);
        emailed++;
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "nothing_to_digest")) {
        await logEvent("digest.failed", user.id, { reason: (err as Error).message.slice(0, 160) });
      }
    }
  }
  await logEvent("cron.daily", null, { processed, due: due.length, created, emailed });
  return { processed, due: due.length, digests: created, emailed };
}
