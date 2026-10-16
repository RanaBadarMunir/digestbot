import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";
import { createToken, listTokens, serializeToken } from "@/server/tokens";

/** Connected browsers. Session cookie only: a token cannot mint or list tokens. */
export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ items: (await listTokens(user)).map(serializeToken) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceRateLimit(`token:${user.id}`, 10, 3600, "Too many connection attempts. Try again later.");
  const { token, record } = await createToken(user, await readJson(req));
  return NextResponse.json({ token, item: serializeToken(record) }, { status: 201, headers: { "cache-control": "no-store" } });
});
