import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { type ApiToken, apiTokens, type User, users } from "@/db/schema";
import { uuidSchema } from "@/lib/validation";
import { logEvent } from "./events";
import { ApiError, notFound } from "./http";

/**
 * Personal access tokens let the browser extension save links without the
 * session cookie. The plaintext is shown once; only its SHA-256 is stored, so a
 * database leak does not leak usable tokens. Tokens are accepted only by the
 * routes that opt in (see `requireUser({ allowToken: true })`).
 */

export const TOKEN_PREFIX = "dbt_";
export const MAX_TOKENS_PER_USER = 10;
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function looksLikeToken(value: string): boolean {
  return /^dbt_[A-Za-z0-9_-]{43}$/.test(value);
}

export function serializeToken(t: ApiToken) {
  return {
    id: t.id,
    name: t.name,
    prefix: `${TOKEN_PREFIX}${t.prefix}…`,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  };
}
export type TokenDTO = ReturnType<typeof serializeToken>;

const createTokenSchema = z.object({ name: z.string().trim().min(1).max(60).optional().default("Browser extension") });

export async function createToken(user: User, input: unknown): Promise<{ token: string; record: ApiToken }> {
  const { name } = createTokenSchema.parse(input);
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(apiTokens).where(eq(apiTokens.userId, user.id));
  if (n >= MAX_TOKENS_PER_USER) {
    throw new ApiError(409, "too_many_tokens", `You already have ${MAX_TOKENS_PER_USER} connected browsers. Disconnect one first.`);
  }
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  const [record] = await db
    .insert(apiTokens)
    .values({ userId: user.id, name, tokenHash: hashToken(token), prefix: secret.slice(0, 6) })
    .returning();
  await logEvent("token.created", user.id, { name });
  return { token, record };
}

export async function listTokens(user: User): Promise<ApiToken[]> {
  const db = await getDb();
  return db.select().from(apiTokens).where(eq(apiTokens.userId, user.id)).orderBy(desc(apiTokens.createdAt));
}

export async function revokeToken(user: User, id: string) {
  if (!uuidSchema.safeParse(id).success) throw notFound("Connection not found.");
  const db = await getDb();
  const rows = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)))
    .returning({ id: apiTokens.id });
  if (!rows.length) throw notFound("Connection not found.");
  await logEvent("token.revoked", user.id);
}

/** Resolves a bearer token to its active user, or null. */
export async function userFromToken(token: string): Promise<{ user: User; tokenId: string } | null> {
  if (!looksLikeToken(token)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: users, tokenId: apiTokens.id, lastUsedAt: apiTokens.lastUsedAt })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, hashToken(token)))
    .limit(1);
  if (!row || row.user.status !== "active") return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.tokenId));
  }
  return { user: row.user, tokenId: row.tokenId };
}

/** Lets the extension disconnect itself: deletes the token it authenticated with. */
export async function revokeTokenById(tokenId: string) {
  const db = await getDb();
  await db.delete(apiTokens).where(eq(apiTokens.id, tokenId));
}
