import { NextResponse } from "next/server";
import { endSession } from "@/server/auth";
import { route } from "@/server/route";

export const POST = route(async () => {
  await endSession();
  return NextResponse.json({ ok: true });
});
