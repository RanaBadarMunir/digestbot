import { NextResponse } from "next/server";
import { adminListUsers } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { route } from "@/server/route";

export const GET = route(async (req) => {
  await requireAdmin();
  const p = new URL(req.url).searchParams;
  return NextResponse.json(await adminListUsers({ q: p.get("q") ?? "", page: Number(p.get("page") ?? 1) }));
});
