import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { processBookmark, resetForResummarize, serializeBookmark } from "@/server/bookmarks";
import { enforceRateLimit } from "@/server/rate-limit";
import { type IdContext, route } from "@/server/route";

export const maxDuration = 60;

export const POST = route<IdContext>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await enforceRateLimit(`resummarize:${user.id}`, 60, 3600);
  await resetForResummarize(user, id);
  const b = await processBookmark(id);
  return NextResponse.json({ bookmark: b ? serializeBookmark(b) : null });
});
