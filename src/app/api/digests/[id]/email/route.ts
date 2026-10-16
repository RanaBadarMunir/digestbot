import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { emailDigest, getDigest } from "@/server/digests";
import { appUrl } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { type IdContext, route } from "@/server/route";

export const POST = route<IdContext>(async (req, { params }) => {
  const user = await requireUser();
  await enforceRateLimit(`email:${user.id}`, 10, 3600, "Too many emails this hour.");
  const digest = await getDigest(user, (await params).id);
  await emailDigest(user, digest, appUrl(req));
  return NextResponse.json({ ok: true });
});
