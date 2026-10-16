import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { processPending } from "@/server/bookmarks";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";

export const maxDuration = 60;

/** Called by the dashboard while some of the user's bookmarks are still pending (self-healing backlog). */
export const POST = route(async () => {
  const user = await requireUser();
  await enforceRateLimit(`process:${user.id}`, 60, 3600);
  return NextResponse.json({ processed: await processPending({ userId: user.id, limit: 5 }) });
});
