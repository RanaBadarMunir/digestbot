import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { type User, users } from "@/db/schema";
import { dummyHashFor, hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "@/lib/session";
import { loginSchema, signupSchema } from "@/lib/validation";
import { logEvent } from "./events";
import { ApiError, forbidden, unauthorized } from "./http";

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
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
  if (!user || user.status !== "active") return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw forbidden("Administrators only.");
  return user;
}
