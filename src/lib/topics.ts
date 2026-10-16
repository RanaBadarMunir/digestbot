import { tokenize } from "./summarize";

export const TOPICS = [
  "AI & Machine Learning",
  "Web Development",
  "Cloud & DevOps",
  "Security",
  "Data & Databases",
  "Product & Design",
  "Business & Startups",
  "Career & Productivity",
  "Science & Tech News",
  "Other",
] as const;

export type Topic = (typeof TOPICS)[number];

const KEYWORDS: Record<Exclude<Topic, "Other">, string[]> = {
  "AI & Machine Learning": [
    "ai", "llm", "llms", "gpt", "gemini", "claude", "openai", "anthropic", "model", "models", "neural", "machine", "learning",
    "transformer", "prompt", "prompts", "agent", "agents", "embedding", "embeddings", "inference", "training", "fine-tuning",
    "rag", "chatbot", "diffusion", "pytorch", "tensorflow", "dataset",
  ],
  "Web Development": [
    "javascript", "typescript", "react", "next.js", "nextjs", "vue", "svelte", "angular", "css", "html", "frontend",
    "browser", "node", "node.js", "npm", "web", "api", "rest", "graphql", "tailwind", "vite", "webpack", "component",
    "components", "dom", "http",
  ],
  "Cloud & DevOps": [
    "kubernetes", "docker", "container", "containers", "aws", "azure", "gcp", "cloud", "serverless", "terraform", "devops",
    "ci", "cd", "pipeline", "deployment", "deploy", "infrastructure", "observability", "monitoring", "sre", "linux",
    "vercel", "nginx", "scaling", "latency", "outage",
  ],
  Security: [
    "security", "vulnerability", "vulnerabilities", "cve", "exploit", "attack", "attacker", "malware", "ransomware",
    "breach", "phishing", "encryption", "auth", "authentication", "oauth", "password", "passwords", "zero-day", "owasp",
    "xss", "injection", "privacy", "threat",
  ],
  "Data & Databases": [
    "database", "databases", "postgres", "postgresql", "mysql", "sql", "nosql", "mongodb", "redis", "query", "queries",
    "index", "indexes", "analytics", "warehouse", "etl", "pipeline", "spark", "kafka", "data", "schema", "sqlite",
  ],
  "Product & Design": [
    "product", "design", "ux", "ui", "user", "users", "research", "figma", "prototype", "onboarding", "feature",
    "features", "roadmap", "usability", "accessibility", "designer", "customer", "customers", "interface",
  ],
  "Business & Startups": [
    "startup", "startups", "funding", "revenue", "founder", "founders", "market", "pricing", "growth", "saas", "investor",
    "investors", "vc", "acquisition", "company", "companies", "business", "sales", "marketing", "ipo", "valuation",
  ],
  "Career & Productivity": [
    "career", "productivity", "remote", "work", "habits", "focus", "meeting", "meetings", "interview", "interviews",
    "hiring", "manager", "management", "team", "teams", "leadership", "burnout", "async", "time", "writing", "learning",
  ],
  "Science & Tech News": [
    "science", "research", "space", "nasa", "physics", "climate", "energy", "quantum", "chip", "chips", "semiconductor",
    "apple", "google", "microsoft", "launch", "announced", "smartphone", "battery", "robot", "robots",
  ],
};

export function isTopic(value: unknown): value is Topic {
  return typeof value === "string" && (TOPICS as readonly string[]).includes(value);
}

/**
 * Rule-based classifier. Title words weigh 3x body words; returns "Other"
 * when nothing reaches a minimal score.
 */
export function classifyTopic(title: string, body: string): Topic {
  const titleWords = tokenize(title);
  const bodyWords = tokenize(body).slice(0, 3000);
  let best: Topic = "Other";
  let bestScore = 0;
  for (const [topic, words] of Object.entries(KEYWORDS) as Array<[Exclude<Topic, "Other">, string[]]>) {
    const set = new Set(words);
    let score = 0;
    for (const w of titleWords) if (set.has(w)) score += 3;
    for (const w of bodyWords) if (set.has(w)) score += 1;
    // normalise so topics with long keyword lists don't win by default
    const normalised = score / Math.sqrt(words.length);
    if (normalised > bestScore) {
      bestScore = normalised;
      best = topic;
    }
  }
  return bestScore >= 0.5 ? best : "Other";
}

/**
 * Priority 1 (high) – 3 (low). Long, substantive reads in a topic the user
 * saves often are worth a full read; very short items are skimmable.
 */
export function estimatePriority(input: { readingMinutes: number; topic: Topic; favouriteTopics?: Topic[] }): 1 | 2 | 3 {
  const fav = input.favouriteTopics?.includes(input.topic) ?? false;
  if (input.readingMinutes >= 8 && fav) return 1;
  if (input.readingMinutes >= 12) return 1;
  if (input.readingMinutes <= 2 && !fav) return 3;
  return 2;
}
