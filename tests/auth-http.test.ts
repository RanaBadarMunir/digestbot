import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/password";
import { signSession, verifySession } from "@/lib/session";
import { signupSchema } from "@/lib/validation";
import { UnsafeUrlError } from "@/lib/url";
import { ApiError, appUrl, assertSameOrigin, clientIp, errorResponse, readJson } from "@/server/http";

describe("passwords", () => {
  it("hashes with bcrypt and verifies", async () => {
    const hash = await hashPassword("secret123", 4);
    expect(hash).toMatch(/^\$2[aby]\$04\$/);
    expect(await verifyPassword("secret123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("sessions", () => {
  it("signs and verifies a JWT", async () => {
    const token = await signSession({ sub: "u1", role: "admin" });
    expect(await verifySession(token)).toEqual({ sub: "u1", role: "admin" });
  });
  it("rejects tampered, empty and foreign tokens", async () => {
    const token = await signSession({ sub: "u1", role: "user" });
    const [h, p, s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "u1", role: "admin", iss: "digestbot" })).toString("base64url");
    expect(await verifySession(`${h}.${forged}.${s}`)).toBeNull();
    expect(await verifySession(`${h}.${p}.x${s}`)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("garbage")).toBeNull();
  });
});

describe("validation", () => {
  it("enforces password rules and normalises email", () => {
    expect(signupSchema.parse({ name: " A ", email: " A@B.COM ", password: "abcdefg1" })).toEqual({ name: "A", email: "a@b.com", password: "abcdefg1" });
    expect(() => signupSchema.parse({ name: "A", email: "a@b.com", password: "short1" })).toThrow();
    expect(() => signupSchema.parse({ name: "A", email: "a@b.com", password: "noDigitsHere" })).toThrow();
    expect(() => signupSchema.parse({ name: "A", email: "nope", password: "abcdefg1" })).toThrow();
  });
});

describe("http helpers", () => {
  const req = (method: string, headers: Record<string, string>) => new Request("https://app.test/api/x", { method, headers });

  it("allows same-origin and header-less requests, blocks cross-site mutations", () => {
    expect(() => assertSameOrigin(req("POST", { origin: "https://app.test", host: "app.test" }))).not.toThrow();
    expect(() => assertSameOrigin(req("POST", { host: "app.test" }))).not.toThrow();
    expect(() => assertSameOrigin(req("GET", { origin: "https://evil.test", host: "app.test" }))).not.toThrow();
    expect(() => assertSameOrigin(req("POST", { origin: "https://evil.test", host: "app.test" }))).toThrow(ApiError);
    expect(() => assertSameOrigin(req("DELETE", { origin: "null", host: "app.test" }))).toThrow(ApiError);
    // the extension authenticates with a bearer token (no cookie), so its extension origin is allowed
    expect(() =>
      assertSameOrigin(req("POST", { origin: "chrome-extension://abcdef", host: "app.test", authorization: "Bearer dbt_x" })),
    ).not.toThrow();
    expect(() => assertSameOrigin(req("POST", { origin: "https://evil.test", host: "app.test", authorization: "Basic eA==" }))).toThrow(ApiError);
  });

  it("maps errors to status codes", async () => {
    expect(errorResponse(new ApiError(409, "x", "conflict")).status).toBe(409);
    let zerr: ZodError | undefined;
    try {
      z.object({ a: z.string() }).parse({});
    } catch (e) {
      zerr = e as ZodError;
    }
    const zr = errorResponse(zerr);
    expect(zr.status).toBe(400);
    expect((await zr.json()).error.fields.a).toBeTruthy();
    expect(errorResponse(new UnsafeUrlError("bad")).status).toBe(400);
    const orig = console.error;
    console.error = () => {};
    const r = errorResponse(new Error("secret internals"));
    console.error = orig;
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("secret internals");
  });

  it("reads JSON bodies defensively", async () => {
    expect(await readJson(new Request("https://a.test", { method: "POST", body: '{"a":1}' }))).toEqual({ a: 1 });
    expect(await readJson(new Request("https://a.test", { method: "POST", body: "" }))).toEqual({});
    await expect(readJson(new Request("https://a.test", { method: "POST", body: "{" }))).rejects.toThrow(/Invalid JSON/);
    await expect(readJson(new Request("https://a.test", { method: "POST", body: "x".repeat(100_001) }))).rejects.toThrow(/too large/);
  });

  it("derives client IP and app URL", () => {
    expect(clientIp(req("GET", { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(req("GET", {}))).toBe("local");
    expect(appUrl(req("GET", { host: "app.test", "x-forwarded-proto": "https" }))).toBe("https://app.test");
  });
});
