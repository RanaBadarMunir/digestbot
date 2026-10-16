import { NextResponse } from "next/server";
import { exportAccount } from "@/server/account";
import { requireUser } from "@/server/auth";
import { route } from "@/server/route";

export const GET = route(async () => {
  const user = await requireUser();
  const data = await exportAccount(user);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="digestbot-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
