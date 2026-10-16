import { getDb } from "@/db";
import { events } from "@/db/schema";

export async function logEvent(type: string, userId: string | null, meta: Record<string, unknown> = {}) {
  try {
    const db = await getDb();
    await db.insert(events).values({ type, userId, meta });
  } catch (err) {
    console.error("event log failed", type, err);
  }
}
