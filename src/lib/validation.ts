import { z } from "zod";
import { TOPICS } from "./topics";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128),
});

export const createBookmarkSchema = z.object({
  url: z.string().trim().min(3, "Paste a link").max(2048, "That link is too long"),
  title: z.string().trim().max(300).optional(),
});

export const bookmarkStatus = z.enum(["unread", "read", "archived"]);

export const listBookmarksSchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  status: z.enum(["unread", "read", "archived", "all"]).optional().default("all"),
  topic: z.string().max(40).optional().default(""),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const updateBookmarkSchema = z
  .object({
    status: bookmarkStatus.optional(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    topic: z.enum(TOPICS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["read", "unread", "archive", "delete"]),
});

export const createDigestSchema = z.object({
  days: z.number().int().min(1).max(31).optional().default(7),
});

export const shareDigestSchema = z.object({ shared: z.boolean() });

export const settingsSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    digestWeekday: z.number().int().min(0).max(6).optional(),
    emailDigest: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128) });

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const uuidSchema = z.string().uuid();
