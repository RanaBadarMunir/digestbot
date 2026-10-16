import { NextResponse } from "next/server";
import { changePassword } from "@/server/account";
import { requireUser } from "@/server/auth";
import { readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceRateLimit(`password:${user.id}`, 10, 900, "Too many attempts. Wait 15 minutes.");
  await changePassword(user, await readJson(req));
  return NextResponse.json({ ok: true });
});
