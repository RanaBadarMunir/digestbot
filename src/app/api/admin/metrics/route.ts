import { NextResponse } from "next/server";
import { adminMetrics } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { route } from "@/server/route";

export const GET = route(async () => {
  await requireAdmin();
  return NextResponse.json(await adminMetrics());
});
