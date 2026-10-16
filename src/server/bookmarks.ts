import { and, count, desc, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { type Bookmark, bookmarks, type User } from "@/db/schema";
import { aiConfigFromEnv, type AiConfig, summarizeWithAi } from "@/lib/ai";
import { type Extracted, extractUrl } from "@/lib/extract";
import { MAX_IMPORT_LINKS, parseBookmarksHtml } from "@/lib/import";
import { readingMinutes, summarizeExtractive } from "@/lib/summarize";
import { classifyTopic, estimatePriority, isTopic, type Topic } from "@/lib/topics";
import { hashUrl, normalizeUrl, siteNameFromUrl, UnsafeUrlError } from "@/lib/url";
import { batchSchema, createBookmarkSchema, listBookmarksSchema, updateBookmarkSchema, uuidSchema } from "@/lib/validation";
import { logEvent } from "./events";
import { badRequest, notFound } from "./http";

export function serializeBookmark(b: Bookmark) {
  return {
    id: b.id,
    url: b.url,
    title: b.title,
    siteName: b.siteName,
    excerpt: b.excerpt,
    summary: b.summary,
    keyPoints: b.keyPoints,
    topic: b.topic,
    tags: b.tags,
    readingMinutes: b.readingMinutes,
    priority: b.priority,
    status: b.status,
    summarySource: b.summarySource,
    error: b.error,
    createdAt: b.createdAt.toISOString(),
    readAt: b.readAt?.toISOString() ?? null,
  };
}
export type BookmarkDTO = ReturnType<typeof serializeBookmark>;

export async function createBookmark(user: User, input: unknown): Promise<{ bookmark: Bookmark; duplicate: boolean }> {
  const data = createBookmarkSchema.parse(input);
  const url = normalizeUrl(data.url);
  const urlHash = hashUrl(url);
  const db = await getDb();
  const inserted = await db
    .insert(bookmarks)
    .values({ userId: user.id, url, urlHash, title: data.title || siteNameFromUrl(url), siteName: siteNameFromUrl(url) })
    .onConflictDoNothing({ target: [bookmarks.userId, bookmarks.urlHash] })
    .returning();
  if (inserted.length) {
    await logEvent("bookmark.created", user.id, { host: siteNameFromUrl(url) });
    return { bookmark: inserted[0], duplicate: false };
  }
  const [existing] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.urlHash, urlHash)))
    .limit(1);
  return { bookmark: existing, duplicate: true };
}

export interface ProcessDeps {
  extract?: (url: string) => Promise<Extracted>;
  ai?: AiConfig;
}

async function favouriteTopics(userId: string): Promise<Topic[]> {
  const db = await getDb();
  const rows = await db
    .select({ topic: bookmarks.topic, n: count() })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), sql`${bookmarks.summarySource} <> 'pending'`))
    .groupBy(bookmarks.topic)
    .orderBy(desc(count()))
    .limit(2);
  return rows.map((r) => r.topic).filter((t): t is Topic => isTopic(t) && t !== "Other");
}

/** Fetch → extract → summarise (AI, else extractive) → classify → store. Never throws. */
export async function processBookmark(id: string, deps: ProcessDeps = {}): Promise<Bookmark | null> {
  const db = await getDb();
  const [b] = await db.select().from(bookmarks).where(eq(bookmarks.id, id)).limit(1);
  if (!b) return null;
  const started = Date.now();
  const extract = deps.extract ?? ((u: string) => extractUrl(u));
  const ai = deps.ai ?? aiConfigFromEnv();

  let page: Extracted;
  try {
    page = await extract(b.url);
  } catch (err) {
    const message = err instanceof UnsafeUrlError ? err.message : `Couldn't read this page: ${(err as Error).message}`;
    const [failed] = await db
      .update(bookmarks)
      .set({ summarySource: "failed", error: message.slice(0, 300) })
      .where(eq(bookmarks.id, id))
      .returning();
    await logEvent("bookmark.failed", b.userId, { reason: message.slice(0, 120) });
    return failed;
  }

  const title = b.title && b.title !== siteNameFromUrl(b.url) ? b.title : page.title;
  const body = page.text || page.excerpt;
  const fallback = summarizeExtractive(body, page.excerpt);
  let summary = fallback.summary;
  let keyPoints = fallback.keyPoints;
  let tags = fallback.tags;
  let topic: Topic = classifyTopic(title, body);
  let source: "ai" | "extractive" = "extractive";
  let worthFullRead = false;
  let aiError: string | undefined;

  if (ai.apiKey && body.length > 80) {
    try {
      const r = await summarizeWithAi(ai, { title, url: b.url, text: body });
      ({ summary, keyPoints, tags, topic, worthFullRead } = r);
      source = "ai";
    } catch (err) {
      aiError = (err as Error).message;
    }
  }

  const minutes = page.text ? readingMinutes(page.text) : 1;
  let priority = estimatePriority({ readingMinutes: minutes, topic, favouriteTopics: await favouriteTopics(b.userId) });
  if (worthFullRead) priority = 1;

  const [updated] = await db
    .update(bookmarks)
    .set({
      title: title.slice(0, 300),
      siteName: page.siteName || b.siteName,
      excerpt: page.excerpt || null,
      contentText: page.text || null,
      summary: summary || page.excerpt || null,
      keyPoints,
      tags,
      topic,
      readingMinutes: minutes,
      priority,
      summarySource: source,
      error: null,
    })
    .where(eq(bookmarks.id, id))
    .returning();
  await logEvent("bookmark.processed", b.userId, { source, ms: Date.now() - started, ...(aiError ? { aiError: aiError.slice(0, 120) } : {}) });
  return updated;
}

/** Runs `fn` over items with bounded concurrency. */
export async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<unknown>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift() as T);
    }),
  );
}

export async function processPending(opts: { userId?: string; limit: number; deps?: ProcessDeps }): Promise<number> {
  const db = await getDb();
  const where = opts.userId
    ? and(eq(bookmarks.summarySource, "pending"), eq(bookmarks.userId, opts.userId))
    : eq(bookmarks.summarySource, "pending");
  const rows = await db.select({ id: bookmarks.id }).from(bookmarks).where(where).orderBy(bookmarks.createdAt).limit(opts.limit);
  await mapLimit(rows, 4, (r) => processBookmark(r.id, opts.deps));
  return rows.length;
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listBookmarks(user: User, query: unknown) {
  const q = listBookmarksSchema.parse(query);
  const db = await getDb();
  const conds: SQL[] = [eq(bookmarks.userId, user.id)];
  if (q.status !== "all") conds.push(eq(bookmarks.status, q.status));
  else conds.push(sql`${bookmarks.status} <> 'archived'`);
  if (q.topic) conds.push(eq(bookmarks.topic, q.topic));
  if (q.q) {
    const pattern = `%${escapeLike(q.q)}%`;
    conds.push(
      or(
        ilike(bookmarks.title, pattern),
        ilike(bookmarks.summary, pattern),
        ilike(bookmarks.siteName, pattern),
        ilike(bookmarks.url, pattern),
        sql`array_to_string(${bookmarks.tags}, ' ') ilike ${pattern}`,
      ) as SQL,
    );
  }
  const where = and(...conds);
  const [items, [{ total }], topics] = await Promise.all([
    db
      .select()
      .from(bookmarks)
      .where(where)
      .orderBy(desc(bookmarks.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ total: count() }).from(bookmarks).where(where),
    db
      .select({ topic: bookmarks.topic, count: count() })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), sql`${bookmarks.status} <> 'archived'`))
      .groupBy(bookmarks.topic)
      .orderBy(desc(count())),
  ]);
  return { items: items.map(serializeBookmark), total, page: q.page, pageSize: q.pageSize, topics };
}

export async function bookmarkStats(user: User) {
  const db = await getDb();
  const [row] = await db
    .select({
      unread: sql<number>`count(*) filter (where ${bookmarks.status} = 'unread')`.mapWith(Number),
      unreadMinutes: sql<number>`coalesce(sum(${bookmarks.readingMinutes}) filter (where ${bookmarks.status} = 'unread'), 0)`.mapWith(Number),
      thisWeek: sql<number>`count(*) filter (where ${bookmarks.createdAt} > now() - interval '7 days')`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${bookmarks.summarySource} = 'pending')`.mapWith(Number),
      total: count(),
    })
    .from(bookmarks)
    .where(eq(bookmarks.userId, user.id));
  return row;
}

export async function getBookmark(user: User, id: string): Promise<Bookmark> {
  if (!uuidSchema.safeParse(id).success) throw notFound("Bookmark not found.");
  const db = await getDb();
  const [b] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, user.id)))
    .limit(1);
  if (!b) throw notFound("Bookmark not found.");
  return b;
}

export async function updateBookmark(user: User, id: string, input: unknown): Promise<Bookmark> {
  const data = updateBookmarkSchema.parse(input);
  await getBookmark(user, id);
  const db = await getDb();
  const [b] = await db
    .update(bookmarks)
    .set({
      ...data,
      ...(data.status ? { readAt: data.status === "read" ? new Date() : null } : {}),
    })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, user.id)))
    .returning();
  return b;
}

export async function deleteBookmark(user: User, id: string) {
  await getBookmark(user, id);
  const db = await getDb();
  await db.delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, user.id)));
}

export async function batchBookmarks(user: User, input: unknown): Promise<number> {
  const { ids, action } = batchSchema.parse(input);
  const db = await getDb();
  const scope = and(eq(bookmarks.userId, user.id), inArray(bookmarks.id, ids));
  const rows =
    action === "delete"
      ? await db.delete(bookmarks).where(scope).returning({ id: bookmarks.id })
      : await db
          .update(bookmarks)
          .set(
            action === "read"
              ? { status: "read", readAt: new Date() }
              : action === "unread"
                ? { status: "unread", readAt: null }
                : { status: "archived" },
          )
          .where(scope)
          .returning({ id: bookmarks.id });
  await logEvent("bookmark.batch", user.id, { action, count: rows.length });
  return rows.length;
}

export async function resetForResummarize(user: User, id: string) {
  await getBookmark(user, id);
  const db = await getDb();
  await db.update(bookmarks).set({ summarySource: "pending", error: null }).where(eq(bookmarks.id, id));
}

export async function importBookmarks(user: User, html: string) {
  const links = parseBookmarksHtml(html, MAX_IMPORT_LINKS + 1);
  if (links.length === 0) throw badRequest("No links found. Export your bookmarks as an HTML file from your browser and try again.");
  const db = await getDb();
  const values: Array<typeof bookmarks.$inferInsert> = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const link of links.slice(0, MAX_IMPORT_LINKS)) {
    try {
      const url = normalizeUrl(link.url);
      const urlHash = hashUrl(url);
      if (seen.has(urlHash)) continue;
      seen.add(urlHash);
      values.push({ userId: user.id, url, urlHash, title: link.title || siteNameFromUrl(url), siteName: siteNameFromUrl(url) });
    } catch {
      skipped++;
    }
  }
  skipped += Math.max(0, links.length - MAX_IMPORT_LINKS);
  let imported = 0;
  for (let i = 0; i < values.length; i += 100) {
    const rows = await db
      .insert(bookmarks)
      .values(values.slice(i, i + 100))
      .onConflictDoNothing({ target: [bookmarks.userId, bookmarks.urlHash] })
      .returning({ id: bookmarks.id });
    imported += rows.length;
  }
  await logEvent("bookmark.imported", user.id, { imported });
  return { imported, duplicates: values.length - imported, skipped };
}

export const importFileSchema = z.object({ size: z.number().max(2 * 1024 * 1024, "File is larger than 2 MB") });
