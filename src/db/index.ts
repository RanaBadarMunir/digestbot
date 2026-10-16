import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

const globalForDb = globalThis as unknown as { __digestbotDb?: Promise<DB> };

/** Production: Neon serverless Postgres over HTTP. */
async function createNeonDb(url: string): Promise<DB> {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  return drizzle(neon(url), { schema }) as unknown as DB;
}

/** Local development and tests: Postgres compiled to WASM, migrated on start. */
export async function createPgliteDb(dataDir?: string): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) (await import("node:fs")).mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__digestbotDb) {
    const url = process.env.DATABASE_URL;
    globalForDb.__digestbotDb = url
      ? createNeonDb(url)
      : createPgliteDb(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite"));
  }
  return globalForDb.__digestbotDb;
}

/** Tests swap in an isolated in-memory database. */
export function setDb(db: DB | undefined) {
  globalForDb.__digestbotDb = db ? Promise.resolve(db) : undefined;
}

export { schema };
