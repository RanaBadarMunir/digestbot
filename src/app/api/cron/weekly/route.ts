import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyJob } from "@/server/digests";
import { appUrl, unauthorized } from "@/server/http";
import { route } from "@/server/route";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Vercel Cron calls this once a day with `Authorization: Bearer $CRON_SECRET`. */
export const GET = route(async (req) => {
  if (!authorised(req)) throw unauthorized("Invalid cron secret.");
  return NextResponse.json(await runDailyJob({ baseUrl: appUrl(req) }));
});
