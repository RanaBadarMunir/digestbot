import { NextResponse } from "next/server";
import { aiEnabled } from "@/lib/ai";
import { updateSettings } from "@/server/account";
import { publicUser, requireUser } from "@/server/auth";
import { emailEnabled } from "@/server/email";
import { readJson } from "@/server/http";
import { route } from "@/server/route";

export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ user: publicUser(user), features: { ai: aiEnabled(), email: emailEnabled() } });
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  return NextResponse.json({ user: publicUser(await updateSettings(user, await readJson(req))) });
});
