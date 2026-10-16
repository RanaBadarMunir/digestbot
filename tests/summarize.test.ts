import { describe, expect, it } from "vitest";
import {
  contentWords,
  countWords,
  readingMinutes,
  scoreSentences,
  splitSentences,
  summarizeExtractive,
  termFrequencies,
  tokenize,
  topKeywords,
} from "@/lib/summarize";
import { classifyTopic, estimatePriority, isTopic, TOPICS } from "@/lib/topics";

const TEXT = `Kubernetes makes it possible to run containers at scale. However, Kubernetes clusters are complex to operate.
Teams often struggle with Kubernetes networking and storage. The weather was nice. Managed Kubernetes services from cloud
providers remove much of the operational burden of running clusters. Still, understanding how Kubernetes schedules containers
helps teams debug production incidents faster. Ok.`;

describe("text utilities", () => {
  it("splits sentences on terminal punctuation", () => {
    expect(splitSentences("One. Two! Three? Four")).toEqual(["One.", "Two!", "Three?", "Four"]);
    expect(splitSentences("   ")).toEqual([]);
  });
  it("tokenizes and filters stopwords", () => {
    expect(tokenize("Node.js's API — C++ and C#")).toEqual(["node.js", "api", "c++", "and", "c#"]);
    expect(contentWords("The cat and the dog are in 2024 houses")).toEqual(["cat", "dog", "houses"]);
  });
  it("counts words and reading minutes (230 wpm, min 1)", () => {
    expect(countWords("a b  c\nd")).toBe(4);
    expect(readingMinutes("word ".repeat(10))).toBe(1);
    expect(readingMinutes("word ".repeat(2300))).toBe(10);
  });
  it("normalises term frequencies to max 1", () => {
    const tf = termFrequencies(["a", "a", "b"]);
    expect(tf.get("a")).toBe(1);
    expect(tf.get("b")).toBe(0.5);
  });
  it("scores topical sentences above filler", () => {
    const sentences = splitSentences(TEXT);
    const scores = scoreSentences(sentences);
    const weather = sentences.findIndex((s) => s.includes("weather"));
    const best = scores.indexOf(Math.max(...scores));
    expect(best).not.toBe(weather);
    expect(scores[weather]).toBeLessThan(Math.max(...scores));
  });
  it("extracts top keywords", () => {
    expect(topKeywords(TEXT)[0]).toBe("kubernetes");
  });
});

describe("summarizeExtractive", () => {
  it("returns a 2-sentence summary in original order plus up to 3 key points", () => {
    const r = summarizeExtractive(TEXT);
    expect(r.summary.length).toBeGreaterThan(20);
    expect(r.summary).toMatch(/Kubernetes/);
    expect(r.summary).not.toMatch(/weather/);
    expect(r.keyPoints.length).toBeLessThanOrEqual(3);
    expect(r.keyPoints.every((k) => !r.summary.includes(k))).toBe(true);
    expect(r.tags).toContain("kubernetes");
    expect(r.readingMinutes).toBe(1);
  });
  it("never repeats a sentence and strips footnote numbers", () => {
    const text =
      "2: The pyramid is based on the assumption that broad tests are slow and brittle. " +
      "Unit tests are fast. 2: The pyramid is based on the assumption that broad tests are slow and brittle. " +
      "Teams should write many unit tests and few broad tests to keep the pyramid healthy. The pyramid helps teams.";
    const r = summarizeExtractive(text);
    expect(r.summary).not.toMatch(/^\d+:/);
    const all = [r.summary, ...r.keyPoints].join(" ");
    expect(all.match(/The pyramid is based on/g)).toHaveLength(1);
  });

  it("falls back to the description when there is no body text", () => {
    const r = summarizeExtractive("", "A short description of the page.");
    expect(r.summary).toBe("A short description of the page.");
    expect(r.keyPoints).toEqual([]);
  });
  it("clips very long summaries", () => {
    const long = Array.from({ length: 5 }, (_, i) => `Sentence ${i} about databases ${"and indexing performance ".repeat(30)}.`).join(" ");
    expect(summarizeExtractive(long).summary.length).toBeLessThanOrEqual(360);
  });
});

describe("topics", () => {
  it("classifies by keywords with title weighting", () => {
    expect(classifyTopic("Fine-tuning LLMs with RAG", "embedding models inference")).toBe("AI & Machine Learning");
    expect(classifyTopic("Kubernetes autoscaling", "docker containers deploy")).toBe("Cloud & DevOps");
    expect(classifyTopic("New XSS vulnerability", "attackers exploit the CVE")).toBe("Security");
    expect(classifyTopic("Postgres index tips", "sql query performance")).toBe("Data & Databases");
    expect(classifyTopic("React Server Components", "javascript frontend")).toBe("Web Development");
    expect(classifyTopic("Grandma's lemon cake", "flour sugar oven")).toBe("Other");
  });
  it("validates topic values", () => {
    expect(isTopic("Security")).toBe(true);
    expect(isTopic("Cooking")).toBe(false);
    expect(TOPICS).toContain("Other");
  });
  it("estimates priority from length and the user's favourite topics", () => {
    expect(estimatePriority({ readingMinutes: 15, topic: "Other" })).toBe(1);
    expect(estimatePriority({ readingMinutes: 9, topic: "Security", favouriteTopics: ["Security"] })).toBe(1);
    expect(estimatePriority({ readingMinutes: 2, topic: "Other" })).toBe(3);
    expect(estimatePriority({ readingMinutes: 2, topic: "Security", favouriteTopics: ["Security"] })).toBe(2);
    expect(estimatePriority({ readingMinutes: 6, topic: "Other" })).toBe(2);
  });
});
