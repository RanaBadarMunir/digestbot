import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { deleteBookmark, getBookmark, serializeBookmark, updateBookmark } from "@/server/bookmarks";
import { readJson } from "@/server/http";
import { type IdContext, route } from "@/server/route";

export const GET = route<IdContext>(async (_req, { params }) => {
  const user = await requireUser();
  return NextResponse.json({ bookmark: serializeBookmark(await getBookmark(user, (await params).id)) });
});

export const PATCH = route<IdContext>(async (req, { params }) => {
  const user = await requireUser();
  const b = await updateBookmark(user, (await params).id, await readJson(req));
  return NextResponse.json({ bookmark: serializeBookmark(b) });
});

export const DELETE = route<IdContext>(async (_req, { params }) => {
  const user = await requireUser();
  await deleteBookmark(user, (await params).id);
  return NextResponse.json({ ok: true });
});
