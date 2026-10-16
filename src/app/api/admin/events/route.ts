import { NextResponse } from "next/server";
import { adminListEvents } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { route } from "@/server/route";

export const GET = route(async (req) => {
  await requireAdmin();
  const p = new URL(req.url).searchParams;
  return NextResponse.json(await adminListEvents({ type: p.get("type") ?? "", page: Number(p.get("page") ?? 1) }));
});
