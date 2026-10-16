import { NextResponse } from "next/server";
import { publicUser, signup, startSession } from "@/server/auth";
import { clientIp, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";

export const POST = route(async (req) => {
  await enforceRateLimit(`signup:${clientIp(req)}`, 10, 3600, "Too many sign-ups from this network. Try again later.");
  const user = await signup(await readJson(req));
  await startSession(user);
  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
});
