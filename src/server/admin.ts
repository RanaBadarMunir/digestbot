import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookmarks, digests, events, type User, users } from "@/db/schema";
import { adminUpdateUserSchema, uuidSchema } from "@/lib/validation";
import { logEvent } from "./events";
import { badRequest, notFound } from "./http";

export async function adminMetrics(now = new Date()) {
  const db = await getDb();
  const since = new Date(now.getTime() - 29 * 864e5);
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [[totals], sources, topics, dailyBookmarks, dailyUsers, dailyDigests] = await Promise.all([
    db
      .select({
        users: sql<number>`(select count(*) from ${users})`.mapWith(Number),
        activeUsers7d: sql<number>`(select count(*) from ${users} where last_login_at > now() - interval '7 days')`.mapWith(Number),
        suspended: sql<number>`(select count(*) from ${users} where status = 'suspended')`.mapWith(Number),
        bookmarks: sql<number>`(select count(*) from ${bookmarks})`.mapWith(Number),
        digests: sql<number>`(select count(*) from ${digests})`.mapWith(Number),
        sharedDigests: sql<number>`(select count(*) from ${digests} where share_token is not null)`.mapWith(Number),
      })
      .from(sql`(select 1) as one`),
    db.select({ source: bookmarks.summarySource, count: count() }).from(bookmarks).groupBy(bookmarks.summarySource),
    db.select({ topic: bookmarks.topic, count: count() }).from(bookmarks).groupBy(bookmarks.topic).orderBy(desc(count())).limit(10),
    db
      .select({ day: sql<string>`to_char(date_trunc('day', ${bookmarks.createdAt}), 'YYYY-MM-DD')`, n: count() })
      .from(bookmarks)
      .where(sql`${bookmarks.createdAt} >= ${sinceIso}::timestamptz`)
      .groupBy(sql`1`),
    db
      .select({ day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`, n: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${sinceIso}::timestamptz`)
      .groupBy(sql`1`),
    db
      .select({ day: sql<string>`to_char(date_trunc('day', ${digests.createdAt}), 'YYYY-MM-DD')`, n: count() })
      .from(digests)
      .where(sql`${digests.createdAt} >= ${sinceIso}::timestamptz`)
      .groupBy(sql`1`),
  ]);

  const toMap = (rows: Array<{ day: string; n: number }>) => new Map(rows.map((r) => [r.day, Number(r.n)]));
  const b = toMap(dailyBookmarks);
  const u = toMap(dailyUsers);
  const d = toMap(dailyDigests);
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(since.getTime() + i * 864e5).toISOString().slice(0, 10);
    return { date: day, bookmarks: b.get(day) ?? 0, signups: u.get(day) ?? 0, digests: d.get(day) ?? 0 };
  });

  return {
    totals,
    summarySources: sources.map((s) => ({ source: s.source, count: Number(s.count) })),
    topics: topics.map((t) => ({ topic: t.topic, count: Number(t.count) })),
    daily,
  };
}

export async function adminListUsers(query: { q?: string; page?: number }) {
  const db = await getDb();
  const page = Math.max(1, Number(query.page) || 1);
  const q = (query.q ?? "").trim().slice(0, 100);
  const where = q ? or(ilike(users.email, `%${q.replace(/[\\%_]/g, "\\$&")}%`), ilike(users.name, `%${q.replace(/[\\%_]/g, "\\$&")}%`)) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        bookmarks: sql<number>`(select count(*) from ${bookmarks} b where b.user_id = "users"."id")`.mapWith(Number),
        digests: sql<number>`(select count(*) from ${digests} d where d.user_id = "users"."id")`.mapWith(Number),
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(25)
      .offset((page - 1) * 25),
    db.select({ total: count() }).from(users).where(where),
  ]);
  return { items, total, page };
}

export async function adminUpdateUser(admin: User, id: string, input: unknown) {
  const data = adminUpdateUserSchema.parse(input);
  if (!uuidSchema.safeParse(id).success) throw notFound("User not found.");
  if (id === admin.id) throw badRequest("You can't change your own role or status.");
  const db = await getDb();
  const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
  if (!user) throw notFound("User not found.");
  if (data.status) await logEvent(data.status === "suspended" ? "admin.user_suspended" : "admin.user_reactivated", admin.id, { target: id });
  if (data.role) await logEvent("admin.role_changed", admin.id, { target: id, role: data.role });
  return user;
}

export async function adminListEvents(query: { type?: string; page?: number }) {
  const db = await getDb();
  const page = Math.max(1, Number(query.page) || 1);
  const type = (query.type ?? "").trim().slice(0, 40);
  const where = type ? and(sql`${events.type} like ${`${type.replace(/[\\%_]/g, "\\$&")}%`}`) : undefined;
  const [items, [{ total }]] = await Promise.all([
    db
      .select({ id: events.id, type: events.type, meta: events.meta, createdAt: events.createdAt, userEmail: users.email })
      .from(events)
      .leftJoin(users, eq(users.id, events.userId))
      .where(where)
      .orderBy(desc(events.id))
      .limit(50)
      .offset((page - 1) * 50),
    db.select({ total: count() }).from(events).where(where),
  ]);
  return { items, total, page };
}
