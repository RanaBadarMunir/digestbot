import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let db = "ok";
  try {
    await (await getDb()).execute(sql`select 1`);
  } catch {
    db = "down";
  }
  const body = {
    status: db === "ok" ? "ok" : "degraded",
    db,
    dbLatencyMs: Date.now() - started,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: db === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
