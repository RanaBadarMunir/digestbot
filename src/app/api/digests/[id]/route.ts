import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { deleteDigest, getDigest, serializeDigest, setDigestShared } from "@/server/digests";
import { appUrl, readJson } from "@/server/http";
import { type IdContext, route } from "@/server/route";

export const GET = route<IdContext>(async (req, { params }) => {
  const user = await requireUser();
  return NextResponse.json({ digest: serializeDigest(await getDigest(user, (await params).id), appUrl(req)) });
});

export const PATCH = route<IdContext>(async (req, { params }) => {
  const user = await requireUser();
  const d = await setDigestShared(user, (await params).id, await readJson(req));
  return NextResponse.json({ digest: serializeDigest(d, appUrl(req)) });
});

export const DELETE = route<IdContext>(async (_req, { params }) => {
  const user = await requireUser();
  await deleteDigest(user, (await params).id);
  return NextResponse.json({ ok: true });
});
