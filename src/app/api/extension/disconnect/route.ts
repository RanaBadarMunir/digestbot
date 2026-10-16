import { NextResponse } from "next/server";
import { requireTokenAuth } from "@/server/auth";
import { logEvent } from "@/server/events";
import { route } from "@/server/route";
import { revokeTokenById } from "@/server/tokens";

/** Called by the extension's "Disconnect" button: deletes the token it is using. */
export const POST = route(async () => {
  const { user, tokenId } = await requireTokenAuth();
  await revokeTokenById(tokenId);
  await logEvent("token.revoked", user.id, { by: "extension" });
  return NextResponse.json({ ok: true });
});
