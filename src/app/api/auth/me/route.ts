import { NextResponse } from "next/server";
import { publicUser, requireUser } from "@/server/auth";
import { route } from "@/server/route";

export const GET = route(async () => NextResponse.json({ user: publicUser(await requireUser()) }));
