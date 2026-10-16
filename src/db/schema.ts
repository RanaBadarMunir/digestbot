import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { DigestContent } from "@/lib/digest";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 10 }).$type<"user" | "admin">().notNull().default("user"),
    status: varchar("status", { length: 10 }).$type<"active" | "suspended">().notNull().default("active"),
    digestWeekday: smallint("digest_weekday").notNull().default(0),
    emailDigest: boolean("email_digest").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export type SummarySource = "pending" | "ai" | "extractive" | "failed";
export type BookmarkStatus = "unread" | "read" | "archived";

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    urlHash: char("url_hash", { length: 64 }).notNull(),
    title: text("title").notNull(),
    siteName: text("site_name"),
    excerpt: text("excerpt"),
    contentText: text("content_text"),
    summary: text("summary"),
    keyPoints: jsonb("key_points").$type<string[]>().notNull().default([]),
    topic: varchar("topic", { length: 40 }).notNull().default("Other"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    readingMinutes: smallint("reading_minutes").notNull().default(1),
    priority: smallint("priority").notNull().default(2),
    status: varchar("status", { length: 10 }).$type<BookmarkStatus>().notNull().default("unread"),
    summarySource: varchar("summary_source", { length: 12 }).$type<SummarySource>().notNull().default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("bookmarks_user_url_uq").on(t.userId, t.urlHash),
    index("bookmarks_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("bookmarks_user_status_idx").on(t.userId, t.status),
    index("bookmarks_pending_idx").on(t.summarySource).where(sql`${t.summarySource} = 'pending'`),
  ],
);

export const digests = pgTable(
  "digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    intro: text("intro").notNull(),
    content: jsonb("content").$type<DigestContent>().notNull(),
    itemCount: integer("item_count").notNull(),
    shareToken: varchar("share_token", { length: 64 }),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("digests_user_created_idx").on(t.userId, t.createdAt.desc()),
    uniqueIndex("digests_share_token_uq").on(t.shareToken),
  ],
);

export const digestItems = pgTable(
  "digest_items",
  {
    digestId: uuid("digest_id")
      .notNull()
      .references(() => digests.id, { onDelete: "cascade" }),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.digestId, t.bookmarkId] })],
);

export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: varchar("type", { length: 40 }).notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_created_idx").on(t.createdAt), index("events_type_created_idx").on(t.type, t.createdAt)],
);

/** Personal access tokens for the browser extension. Only a SHA-256 hash is stored. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("api_tokens_hash_uq").on(t.tokenHash), index("api_tokens_user_idx").on(t.userId)],
);

export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 200 }).primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export type User = typeof users.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Digest = typeof digests.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
