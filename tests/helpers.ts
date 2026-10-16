import { createPgliteDb, setDb } from "@/db";

/** Fresh in-memory Postgres (PGlite) with all migrations applied. */
export async function freshDb() {
  const db = await createPgliteDb();
  setDb(db);
  return db;
}

export const ARTICLE_HTML = `<!doctype html><html><head>
<title>Postgres indexing guide</title>
<meta property="og:title" content="A practical guide to Postgres indexes">
<meta property="og:site_name" content="Example Engineering">
<meta name="description" content="How B-tree, GIN and partial indexes speed up real queries.">
</head><body><nav>Home About</nav><article>
<h1>A practical guide to Postgres indexes</h1>
<p>Indexes are the single most effective tool for making Postgres queries fast, but every index also slows down writes and uses disk space.</p>
<p>A B-tree index is the default in Postgres and supports equality and range queries on sortable data such as numbers, dates and text.</p>
<p>GIN indexes are designed for composite values like arrays and JSONB documents, which makes them ideal for tags and full text search.</p>
<p>Partial indexes only cover rows matching a condition, so a queue table can index just the pending jobs and stay tiny and fast.</p>
<p>Always confirm that the query planner uses your index by running EXPLAIN ANALYZE on the real query with realistic data volumes.</p>
<p>Unused indexes should be dropped, because they cost write performance and vacuum time without making any query faster for the database.</p>
</article><footer>Copyright</footer></body></html>`;
