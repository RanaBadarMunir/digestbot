/**
 * Demo data for local development and the live demo:
 *   npx tsx scripts/seed.ts
 * Creates demo@digestbot.app (password: digest-demo-1) with a week of summarised bookmarks.
 * Uses DATABASE_URL when set, otherwise the local PGlite database.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { bookmarks, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/password";
import { hashUrl, normalizeUrl } from "../src/lib/url";

const DEMO_EMAIL = "demo@digestbot.app";

const SAMPLES = [
  {
    url: "https://martinfowler.com/bliki/TechnicalDebt.html",
    title: "Technical Debt",
    siteName: "martinfowler.com",
    topic: "Web Development",
    minutes: 6,
    priority: 1,
    summary: "Technical debt is the extra effort future changes cost because of shortcuts in the code today. Like financial debt it accrues interest, so teams should pay it down where they change code most often.",
    keyPoints: ["Cruft makes every future feature slower to build", "Pay down debt in the areas you modify frequently", "Not all debt is worth repaying"],
    tags: ["refactoring", "code quality", "architecture"],
  },
  {
    url: "https://paulgraham.com/hwh.html",
    title: "How to Work Hard",
    siteName: "paulgraham.com",
    topic: "Career & Productivity",
    minutes: 18,
    priority: 1,
    summary: "Paul Graham argues that great work needs both talent and sustained hard work, and that the key is learning to tell real work from its imitations while protecting long stretches of focus.",
    keyPoints: ["Work on what you find genuinely interesting", "Constantly ask whether you are working on the right problem", "Hard work is measured over years, not days"],
    tags: ["focus", "career", "essays"],
  },
  {
    url: "https://en.wikipedia.org/wiki/Large_language_model",
    title: "Large language model",
    siteName: "Wikipedia",
    topic: "AI & Machine Learning",
    minutes: 25,
    priority: 2,
    summary: "A large language model is a neural network trained on vast text corpora to predict tokens, which lets it generate and transform language. Modern LLMs use the transformer architecture and are adapted with fine-tuning and reinforcement learning.",
    keyPoints: ["Transformers enabled today's LLMs", "Instruction tuning and RLHF shape model behaviour", "Hallucination and bias remain open problems"],
    tags: ["llm", "transformers", "ai"],
  },
  {
    url: "https://www.postgresql.org/docs/current/indexes-partial.html",
    title: "Partial Indexes",
    siteName: "PostgreSQL Documentation",
    topic: "Data & Databases",
    minutes: 5,
    priority: 2,
    summary: "A partial index covers only rows that satisfy a predicate, which keeps the index small and fast for queries that target a well-defined subset such as unprocessed queue items.",
    keyPoints: ["Index only the rows queries actually look up", "The planner must be able to prove the predicate", "Useful for unique constraints on a subset"],
    tags: ["postgres", "indexes", "performance"],
  },
  {
    url: "https://owasp.org/Top10/",
    title: "OWASP Top 10",
    siteName: "OWASP",
    topic: "Security",
    minutes: 9,
    priority: 2,
    summary: "The OWASP Top 10 is the standard awareness document of the most critical web application security risks, led by broken access control, cryptographic failures and injection.",
    keyPoints: ["Broken access control is the #1 risk", "SSRF entered the list in 2021", "Use it as a baseline for secure development"],
    tags: ["owasp", "appsec", "web security"],
  },
  {
    url: "https://basecamp.com/guides/how-we-communicate",
    title: "How we communicate",
    siteName: "Basecamp",
    topic: "Career & Productivity",
    minutes: 7,
    priority: 3,
    summary: "Basecamp's communication guide favours writing over meetings and asynchronous updates over real-time chat, so that people keep long uninterrupted stretches of time.",
    keyPoints: ["Write long-form, discuss less", "Real-time chat is for small talk, not decisions", "Meetings are the last resort"],
    tags: ["async", "remote work", "communication"],
  },
];

async function main() {
  const db = await getDb();
  let [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email: DEMO_EMAIL, name: "Demo User", passwordHash: await hashPassword("digest-demo-1") })
      .returning();
  }
  let added = 0;
  for (const [i, s] of SAMPLES.entries()) {
    const url = normalizeUrl(s.url);
    const rows = await db
      .insert(bookmarks)
      .values({
        userId: user.id,
        url,
        urlHash: hashUrl(url),
        title: s.title,
        siteName: s.siteName,
        summary: s.summary,
        keyPoints: s.keyPoints,
        tags: s.tags,
        topic: s.topic,
        readingMinutes: s.minutes,
        priority: s.priority,
        summarySource: "extractive",
        createdAt: new Date(Date.now() - i * 864e5),
      })
      .onConflictDoNothing()
      .returning({ id: bookmarks.id });
    added += rows.length;
  }
  console.log(`Seeded ${DEMO_EMAIL} (password: digest-demo-1) with ${added} new bookmarks.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
