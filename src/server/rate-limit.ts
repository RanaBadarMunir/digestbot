import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";
import { ApiError } from "./http";

/**
 * Fixed-window limiter stored in Postgres so it works across serverless
 * instances. One atomic upsert per check.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; remaining: number }> {
  const db = await getDb();
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart: new Date(), count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds}) then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSeconds}) then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count });
  const count = rows[0]?.count ?? 1;
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number, message = "Too many requests. Please wait a moment.") {
  const { ok } = await rateLimit(key, limit, windowSeconds);
  if (!ok) throw new ApiError(429, "rate_limited", message);
}
