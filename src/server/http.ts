import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnsafeUrlError } from "@/lib/url";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, fields?: Record<string, string>) => new ApiError(400, "bad_request", msg, fields);
export const unauthorized = (msg = "Please log in.") => new ApiError(401, "unauthorized", msg);
export const forbidden = (msg = "You don't have access to this.") => new ApiError(403, "forbidden", msg);
export const notFound = (msg = "Not found.") => new ApiError(404, "not_found", msg);

export function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, fields: err.fields } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const fields = zodFields(err);
    return NextResponse.json(
      { error: { code: "validation", message: Object.values(fields)[0] ?? "Invalid input.", fields } },
      { status: 400 },
    );
  }
  if (err instanceof UnsafeUrlError) {
    return NextResponse.json({ error: { code: "invalid_url", message: err.message } }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: { code: "server_error", message: "Something went wrong. Please try again." } }, { status: 500 });
}

/**
 * CSRF defence for cookie-authenticated mutations: the browser always sends
 * Origin on cross-site POST/PATCH/DELETE, and it must match our host.
 */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, tests) — cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Bad origin.");
  }
  if (!host || originHost !== host) throw forbidden("Cross-site request blocked.");
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 100_000) throw badRequest("Request body too large.");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Invalid JSON body.");
  }
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function appUrl(req?: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (req) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    if (host) return `${proto}://${host}`;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
