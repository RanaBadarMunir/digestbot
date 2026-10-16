import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { type IdContext, route } from "@/server/route";
import { revokeToken } from "@/server/tokens";

export const DELETE = route<IdContext>(async (_req, { params }) => {
  const user = await requireUser();
  await revokeToken(user, (await params).id);
  return NextResponse.json({ ok: true });
});
