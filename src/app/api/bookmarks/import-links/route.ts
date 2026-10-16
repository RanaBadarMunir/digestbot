import { after, NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { importLinksJson, processPending } from "@/server/bookmarks";
import { readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";

export const maxDuration = 60;

/** The extension's "Import all my browser bookmarks": up to 500 links per request. */
export const POST = route(async (req) => {
  const user = await requireUser({ allowToken: true });
  await enforceRateLimit(`import:${user.id}`, 10, 3600, "Too many imports this hour.");
  const result = await importLinksJson(user, await readJson(req));
  if (result.imported) after(() => processPending({ userId: user.id, limit: 20 }));
  return NextResponse.json(result);
});
