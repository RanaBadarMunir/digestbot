import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { batchBookmarks } from "@/server/bookmarks";
import { readJson } from "@/server/http";
import { route } from "@/server/route";

export const POST = route(async (req) => {
  const user = await requireUser();
  return NextResponse.json({ updated: await batchBookmarks(user, await readJson(req)) });
});
