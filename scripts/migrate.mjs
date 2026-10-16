// Applies SQL migrations in ./drizzle to the production database (DATABASE_URL).
// Runs as part of the Vercel build; skipped locally where PGlite migrates itself.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set — skipping (local PGlite migrates on start).");
  process.exit(0);
}

const started = Date.now();
await migrate(drizzle(neon(url)), { migrationsFolder: "./drizzle" });
console.log(`[migrate] done in ${Date.now() - started} ms`);
