import { NextResponse } from "next/server";
import { adminUpdateUser } from "@/server/admin";
import { publicUser, requireAdmin } from "@/server/auth";
import { readJson } from "@/server/http";
import { type IdContext, route } from "@/server/route";

export const PATCH = route<IdContext>(async (req, { params }) => {
  const admin = await requireAdmin();
  const user = await adminUpdateUser(admin, (await params).id, await readJson(req));
  return NextResponse.json({ user: publicUser(user) });
});
