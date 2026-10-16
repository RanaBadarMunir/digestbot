CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"url_hash" char(64) NOT NULL,
	"title" text NOT NULL,
	"site_name" text,
	"excerpt" text,
	"content_text" text,
	"summary" text,
	"key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topic" varchar(40) DEFAULT 'Other' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"reading_minutes" smallint DEFAULT 1 NOT NULL,
	"priority" smallint DEFAULT 2 NOT NULL,
	"status" varchar(10) DEFAULT 'unread' NOT NULL,
	"summary_source" varchar(12) DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "digest_items" (
	"digest_id" uuid NOT NULL,
	"bookmark_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "digest_items_digest_id_bookmark_id_pk" PRIMARY KEY("digest_id","bookmark_id")
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"title" text NOT NULL,
	"intro" text NOT NULL,
	"content" jsonb NOT NULL,
	"item_count" integer NOT NULL,
	"share_token" varchar(64),
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"type" varchar(40) NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" varchar(80) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(10) DEFAULT 'user' NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"digest_weekday" smallint DEFAULT 0 NOT NULL,
	"email_digest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_items" ADD CONSTRAINT "digest_items_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_items" ADD CONSTRAINT "digest_items_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_url_uq" ON "bookmarks" USING btree ("user_id","url_hash");--> statement-breakpoint
CREATE INDEX "bookmarks_user_created_idx" ON "bookmarks" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "bookmarks_user_status_idx" ON "bookmarks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "bookmarks_pending_idx" ON "bookmarks" USING btree ("summary_source") WHERE "bookmarks"."summary_source" = 'pending';--> statement-breakpoint
CREATE INDEX "digests_user_created_idx" ON "digests" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "digests_share_token_uq" ON "digests" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_type_created_idx" ON "events" USING btree ("type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");