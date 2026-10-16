import { after, NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { bookmarkStats, createBookmark, listBookmarks, processBookmark, serializeBookmark } from "@/server/bookmarks";
import { readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";

export const maxDuration = 60;

export const GET = route(async (req) => {
  const user = await requireUser();
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const [list, stats] = await Promise.all([listBookmarks(user, params), bookmarkStats(user)]);
  return NextResponse.json({ ...list, stats });
});

export const POST = route(async (req) => {
  const user = await requireUser({ allowToken: true });
  await enforceRateLimit(`bookmark:${user.id}`, 200, 3600, "You've saved a lot of links this hour — please wait a bit.");
  const { bookmark, duplicate } = await createBookmark(user, await readJson(req));
  if (!duplicate) after(() => processBookmark(bookmark.id));
  return NextResponse.json({ bookmark: serializeBookmark(bookmark), duplicate }, { status: duplicate ? 200 : 201 });
});
