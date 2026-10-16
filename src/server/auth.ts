import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getDb } from "@/db";
import { type User, users } from "@/db/schema";
import { dummyHashFor, hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "@/lib/session";
import { loginSchema, signupSchema } from "@/lib/validation";
import { logEvent } from "./events";
import { ApiError, forbidden, unauthorized } from "./http";
import { userFromToken } from "./tokens";

export type PublicUser = ReturnType<typeof publicUser>;

export function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    digestWeekday: u.digestWeekday,
    emailDigest: u.emailDigest,
    createdAt: u.createdAt.toISOString(),
  };
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function signup(input: unknown, passwordCost?: number): Promise<User> {
  const data = signupSchema.parse(input);
  const db = await getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (existing.length) throw new ApiError(409, "email_taken", "An account with this email already exists.", { email: "Already registered" });
  const passwordHash = await hashPassword(data.password, passwordCost);
  const [user] = await db
    .insert(users)
    .values({
      name: data.name,
      email: data.email,
      passwordHash,
      role: adminEmails().has(data.email) ? "admin" : "user",
      lastLoginAt: new Date(),
    })
    .returning();
  await logEvent("auth.signup", user.id);
  return user;
}

export async function login(input: unknown, passwordCost?: number): Promise<User> {
  const data = loginSchema.parse(input);
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  const ok = await verifyPassword(data.password, user?.passwordHash ?? (await dummyHashFor(passwordCost)));
  if (!user || !ok) {
    await logEvent("auth.login_failed", user?.id ?? null, { email: data.email });
    throw new ApiError(401, "invalid_credentials", "Email or password is incorrect.");
  }
  if (user.status === "suspended") {
    await logEvent("auth.login_blocked", user.id);
    throw forbidden("This account is suspended. Contact the administrator.");
  }
  // keep admin list in sync with configuration
  const role = adminEmails().has(user.email) ? "admin" : user.role;
  const [updated] = await db.update(users).set({ lastLoginAt: new Date(), role }).where(eq(users.id, user.id)).returning();
  await logEvent("auth.login", user.id);
  return updated;
}

export async function startSession(user: User) {
  const token = await signSession({ sub: user.id, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function endSession() {
  (await cookies()).set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

/** Loads the session user from the DB on every call, so suspensions and role changes apply immediately. */
async function bearerToken(): Promise<string | null> {
  const auth = (await headers()).get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

/**
 * A request carrying `Authorization: Bearer …` is authenticated by that token
 * only (never by the cookie), and only where the route opts in with
 * `allowToken`, so an extension token can save links but cannot read digests,
 * change settings or use the admin API.
 */
export async function currentUser(opts: { allowToken?: boolean } = {}): Promise<User | null> {
  const bearer = await bearerToken();
  if (bearer !== null) {
    if (!opts.allowToken) return null;
    return (await userFromToken(bearer))?.user ?? null;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  if (!user || user.status !== "active") return null;
  return user;
}

export async function requireUser(opts: { allowToken?: boolean } = {}): Promise<User> {
  const user = await currentUser(opts);
  if (!user) throw unauthorized();
  return user;
}

/** For the extension's own endpoints: the token's user and the token's id. */
export async function requireTokenAuth(): Promise<{ user: User; tokenId: string }> {
  const bearer = await bearerToken();
  const auth = bearer ? await userFromToken(bearer) : null;
  if (!auth) throw unauthorized("This browser is not connected to DigestBot.");
  return auth;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw forbidden("Administrators only.");
  return user;
}
