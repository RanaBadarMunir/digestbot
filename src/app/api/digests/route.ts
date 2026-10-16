import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { generateDigest, listDigests, serializeDigest } from "@/server/digests";
import { appUrl, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";

export const maxDuration = 60;

export const GET = route(async (req) => {
  const user = await requireUser();
  const base = appUrl(req);
  const items = (await listDigests(user)).map((d) => {
    const { content, ...rest } = serializeDigest(d, base);
    return { ...rest, stats: content.stats };
  });
  return NextResponse.json({ items });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceRateLimit(`digest:${user.id}`, 20, 3600, "You've generated many digests this hour — please wait a bit.");
  const digest = await generateDigest(user, await readJson(req));
  return NextResponse.json({ digest: serializeDigest(digest, appUrl(req)) }, { status: 201 });
});
