import { after, NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { importBookmarks, processPending } from "@/server/bookmarks";
import { badRequest } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { route } from "@/server/route";

export const maxDuration = 60;

export const POST = route(async (req) => {
  const user = await requireUser();
  await enforceRateLimit(`import:${user.id}`, 5, 3600, "Too many imports this hour.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Choose a bookmarks .html file to import.");
  if (file.size > 2 * 1024 * 1024) throw badRequest("That file is larger than 2 MB.");
  const result = await importBookmarks(user, await file.text());
  if (result.imported) after(() => processPending({ userId: user.id, limit: 20 }));
  return NextResponse.json(result);
});
