/**
 * Offline extractive summariser: scores sentences by the frequency of their
 * content words (TF), with a bonus for early position and a penalty for very
 * short or very long sentences, then returns the best ones in original order.
 * Used whenever Gemini is not configured or fails.
 */

export const STOPWORDS = new Set(
  (
    "a about above after again against all also am an and any are as at be because been before being below between both but by " +
    "can could did do does doing down during each few for from further had has have having he her here hers herself him himself his " +
    "how i if in into is it its itself just let me more most my myself no nor not now of off on once only or other our ours " +
    "ourselves out over own same she should so some such than that the their theirs them themselves then there these they this " +
    "those through to too under until up very was we were what when where which while who whom why will with would you your " +
    "yours yourself yourselves new one two get got like make made many much may might must need use used using via way well " +
    "will year years us said says say see seen still every even really thing things lot lots go going without within " +
    "however another something anything always never often rather quite actually maybe perhaps "
  )
    .split(/\s+/)
    .filter(Boolean),
);

const WORDS_PER_MINUTE = 230;

export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [cleaned];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#'.-]*[a-z0-9+#]|[a-z]/g) ?? []).map((w) => w.replace(/'s$/, ""));
}

export function contentWords(text: string): string[] {
  return tokenize(text).filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

export function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(countWords(text) / WORDS_PER_MINUTE));
}

export function termFrequencies(words: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1);
  const max = Math.max(1, ...tf.values());
  for (const [w, n] of tf) tf.set(w, n / max);
  return tf;
}

export function scoreSentences(sentences: string[]): number[] {
  const tf = termFrequencies(sentences.flatMap(contentWords));
  return sentences.map((s, i) => {
    const words = contentWords(s);
    const len = countWords(s);
    if (words.length === 0) return 0;
    const base = words.reduce((sum, w) => sum + (tf.get(w) ?? 0), 0) / Math.sqrt(words.length);
    const position = i === 0 ? 1.3 : i < 3 ? 1.15 : 1;
    const lengthPenalty = len < 6 ? 0.4 : len > 45 ? 0.6 : 1;
    return base * position * lengthPenalty;
  });
}

export function topKeywords(text: string, k = 5): string[] {
  const words = contentWords(text).filter((w) => w.length > 3);
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n > 1 || counts.size < 12)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, k)
    .map(([w]) => w);
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6))}…`;
}

export interface ExtractiveSummary {
  summary: string;
  keyPoints: string[];
  tags: string[];
  readingMinutes: number;
}

export function summarizeExtractive(rawText: string, fallback = ""): ExtractiveSummary {
  // drop footnote markers like [2] or [citation needed]
  const text = rawText.replace(/\[(\d{1,3}|citation needed|edit)\]/gi, "");
  const sentences = splitSentences(text).filter((s) => countWords(s) >= 4).slice(0, 400);
  if (sentences.length === 0) {
    const f = fallback.trim();
    return { summary: f ? clip(f, 320) : "", keyPoints: [], tags: topKeywords(`${text} ${fallback}`), readingMinutes: readingMinutes(text) };
  }
  const scores = scoreSentences(sentences);
  const ranked = sentences.map((s, i) => ({ s, i, score: scores[i] })).sort((a, b) => b.score - a.score || a.i - b.i);
  const summaryPicks = ranked.slice(0, 2).sort((a, b) => a.i - b.i);
  const summary = clip(summaryPicks.map((p) => p.s).join(" "), 360);
  const used = new Set(summaryPicks.map((p) => p.i));
  const keyPoints = ranked
    .filter((p) => !used.has(p.i))
    .slice(0, 3)
    .sort((a, b) => a.i - b.i)
    .map((p) => clip(p.s, 180));
  return { summary, keyPoints, tags: topKeywords(text), readingMinutes: readingMinutes(text) };
}
