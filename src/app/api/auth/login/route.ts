import { NextResponse } from "next/server";
import { login, publicUser, startSession } from "@/server/auth";
import { clientIp, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";

export const POST = route(async (req) => {
  const body = (await readJson(req)) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  await enforceRateLimit(`login:${clientIp(req)}:${email}`, 10, 900, "Too many login attempts. Wait 15 minutes and try again.");
  const user = await login(body);
  await startSession(user);
  return NextResponse.json({ user: publicUser(user) });
});
