import { NextResponse } from "next/server";
import { deleteAccount } from "@/server/account";
import { endSession, requireUser } from "@/server/auth";
import { readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";

export const DELETE = route(async (req) => {
  const user = await requireUser();
  await enforceRateLimit(`delete-account:${user.id}`, 5, 900, "Too many attempts. Wait 15 minutes.");
  await deleteAccount(user, await readJson(req));
  await endSession();
  return NextResponse.json({ ok: true });
});
