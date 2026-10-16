import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookmarks, digests, type User, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { changePasswordSchema, deleteAccountSchema, settingsSchema } from "@/lib/validation";
import { logEvent } from "./events";
import { ApiError } from "./http";

export async function updateSettings(user: User, input: unknown): Promise<User> {
  const data = settingsSchema.parse(input);
  const db = await getDb();
  const [u] = await db.update(users).set(data).where(eq(users.id, user.id)).returning();
  return u;
}

export async function changePassword(user: User, input: unknown, cost?: number) {
  const data = changePasswordSchema.parse(input);
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw new ApiError(401, "invalid_credentials", "Your current password is incorrect.", { currentPassword: "Incorrect password" });
  }
  const db = await getDb();
  await db.update(users).set({ passwordHash: await hashPassword(data.newPassword, cost) }).where(eq(users.id, user.id));
  await logEvent("auth.password_changed", user.id);
}

export async function exportAccount(user: User) {
  const db = await getDb();
  const [b, d] = await Promise.all([
    db.select().from(bookmarks).where(eq(bookmarks.userId, user.id)).orderBy(desc(bookmarks.createdAt)),
    db.select().from(digests).where(eq(digests.userId, user.id)).orderBy(desc(digests.createdAt)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    user: { name: user.name, email: user.email, createdAt: user.createdAt, digestWeekday: user.digestWeekday, emailDigest: user.emailDigest },
    bookmarks: b.map((x) => ({
      url: x.url,
      title: x.title,
      siteName: x.siteName,
      summary: x.summary,
      keyPoints: x.keyPoints,
      topic: x.topic,
      tags: x.tags,
      readingMinutes: x.readingMinutes,
      priority: x.priority,
      status: x.status,
      createdAt: x.createdAt,
      readAt: x.readAt,
    })),
    digests: d.map((x) => ({
      title: x.title,
      intro: x.intro,
      periodStart: x.periodStart,
      periodEnd: x.periodEnd,
      content: x.content,
      createdAt: x.createdAt,
    })),
  };
}

export async function deleteAccount(user: User, input: unknown) {
  const { password } = deleteAccountSchema.parse(input);
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, "invalid_credentials", "Password is incorrect.", { password: "Incorrect password" });
  }
  const db = await getDb();
  await logEvent("account.deleted", null, { emailDomain: user.email.split("@")[1] });
  await db.delete(users).where(eq(users.id, user.id));
}
