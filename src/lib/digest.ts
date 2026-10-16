/** Pure digest-building logic: selection, ranking, grouping, stats, intro, email HTML. */

export interface DigestSourceItem {
  id: string;
  url: string;
  title: string;
  siteName: string | null;
  summary: string | null;
  excerpt: string | null;
  keyPoints: string[];
  topic: string;
  readingMinutes: number;
  priority: number;
  status: "unread" | "read" | "archived";
  createdAt: Date;
}

export interface DigestItem {
  id: string;
  url: string;
  title: string;
  siteName: string;
  summary: string;
  keyPoints: string[];
  topic: string;
  readingMinutes: number;
  priority: number;
}

export interface DigestStats {
  items: number;
  readingMinutes: number;
  digestMinutes: number;
  minutesSaved: number;
  topics: number;
}

export interface DigestContent {
  stats: DigestStats;
  picks: DigestItem[];
  sections: Array<{ topic: string; items: DigestItem[] }>;
}

export interface BuiltDigest {
  title: string;
  intro: string;
  content: DigestContent;
  itemIds: string[];
}

export const MAX_DIGEST_ITEMS = 30;

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatPeriod(start: string, end: string): string {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  if (ys === ye && ms === me) return `${ds}–${de} ${MONTHS[me - 1]} ${ye}`;
  if (ys === ye) return `${ds} ${MONTHS[ms - 1]} – ${de} ${MONTHS[me - 1]} ${ye}`;
  return `${ds} ${MONTHS[ms - 1]} ${ys} – ${de} ${MONTHS[me - 1]} ${ye}`;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Period covering the `days` days ending today (inclusive). */
export function periodEnding(now: Date, days = 7): { start: Date; end: Date; periodStart: string; periodEnd: string } {
  const end = new Date(now);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  return { start, end, periodStart: toIsoDate(start), periodEnd: toIsoDate(end) };
}

function toItem(b: DigestSourceItem): DigestItem {
  return {
    id: b.id,
    url: b.url,
    title: b.title,
    siteName: b.siteName ?? new URL(b.url).hostname.replace(/^www\./, ""),
    summary: b.summary || b.excerpt || "No summary available — open the original.",
    keyPoints: b.keyPoints.slice(0, 3),
    topic: b.topic,
    readingMinutes: b.readingMinutes,
    priority: b.priority,
  };
}

/** Higher priority (lower number) first, unread before read, then newest first. */
export function rankItems<T extends Pick<DigestSourceItem, "priority" | "status" | "createdAt">>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.priority - b.priority ||
      Number(a.status !== "unread") - Number(b.status !== "unread") ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export function templateIntro(stats: DigestStats, sections: DigestContent["sections"], picks: number): string {
  const top = sections.slice(0, 2).map((s) => s.topic);
  const about = top.length === 2 ? `mostly about ${top[0]} and ${top[1]}` : top.length === 1 ? `mostly about ${top[0]}` : "";
  const links = stats.items === 1 ? "1 link" : `${stats.items} links`;
  const pickLine =
    picks === 0 ? "" : picks === 1 ? " One of them deserves your full attention." : ` ${picks} of them deserve your full attention.`;
  return (
    `This week you saved ${links}${about ? ` — ${about}` : ""}. Reading them all would take about ` +
    `${formatMinutes(stats.readingMinutes)}; this digest takes about ${formatMinutes(stats.digestMinutes)}.${pickLine}`
  );
}

export function buildDigest(
  source: DigestSourceItem[],
  period: { periodStart: string; periodEnd: string },
  maxItems = MAX_DIGEST_ITEMS,
): BuiltDigest | null {
  const eligible = rankItems(source.filter((b) => b.status !== "archived")).slice(0, maxItems);
  if (eligible.length === 0) return null;

  const items = eligible.map(toItem);
  const byTopic = new Map<string, DigestItem[]>();
  for (const it of items) byTopic.set(it.topic, [...(byTopic.get(it.topic) ?? []), it]);
  const sections = [...byTopic.entries()]
    .sort((a, b) => b[1].length - a[1].length || (a[0] === "Other" ? 1 : b[0] === "Other" ? -1 : a[0].localeCompare(b[0])))
    .map(([topic, list]) => ({ topic, items: list }));

  const picks = eligible
    .filter((b) => b.status === "unread" && b.priority === 1)
    .slice(0, 3)
    .map(toItem);
  if (picks.length === 0) {
    const longest = [...eligible].filter((b) => b.status === "unread").sort((a, b) => b.readingMinutes - a.readingMinutes)[0];
    if (longest && longest.readingMinutes >= 5) picks.push(toItem(longest));
  }

  const readingMinutes = items.reduce((s, i) => s + i.readingMinutes, 0);
  const digestWords = items.reduce((s, i) => s + (i.summary + " " + i.keyPoints.join(" ")).split(/\s+/).length + i.title.split(/\s+/).length, 0);
  const digestMinutes = Math.max(1, Math.round(digestWords / 230));
  const stats: DigestStats = {
    items: items.length,
    readingMinutes,
    digestMinutes,
    minutesSaved: Math.max(0, readingMinutes - digestMinutes),
    topics: sections.length,
  };

  return {
    title: `Your weekly digest · ${formatPeriod(period.periodStart, period.periodEnd)}`,
    intro: templateIntro(stats, sections, picks.length),
    content: { stats, picks, sections },
    itemIds: items.map((i) => i.id),
  };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : "#";
}

/** Email-safe HTML (inline styles, table-free single column). */
export function renderDigestEmail(d: { title: string; intro: string; content: DigestContent }, viewUrl: string): string {
  const { stats, picks, sections } = d.content;
  const item = (i: DigestItem) => `
    <div style="padding:14px 0;border-top:1px solid #e5e7eb">
      <a href="${safeHref(i.url)}" style="color:#111827;font-weight:600;font-size:16px;text-decoration:none">${escapeHtml(i.title)}</a>
      <div style="color:#6b7280;font-size:12px;margin:2px 0 6px">${escapeHtml(i.siteName)} · ${i.readingMinutes} min read</div>
      <div style="color:#374151;font-size:14px;line-height:1.5">${escapeHtml(i.summary)}</div>
      ${i.keyPoints.length ? `<ul style="color:#4b5563;font-size:13px;line-height:1.5;margin:6px 0 0;padding-left:18px">${i.keyPoints.map((k) => `<li>${escapeHtml(k)}</li>`).join("")}</ul>` : ""}
    </div>`;
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px">
    <div style="background:#0f172a;color:#fff;border-radius:14px 14px 0 0;padding:22px 24px">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#a5b4fc">DigestBot</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">${escapeHtml(d.title)}</div>
    </div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:20px 24px">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 12px">${escapeHtml(d.intro)}</p>
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px">${stats.items} links · ${formatMinutes(stats.readingMinutes)} of reading · ${formatMinutes(stats.minutesSaved)} saved</p>
      ${picks.length ? `<h2 style="font-size:15px;color:#4f46e5;margin:18px 0 0">★ Worth a full read</h2>${picks.map(item).join("")}` : ""}
      ${sections.map((s) => `<h2 style="font-size:15px;color:#111827;margin:22px 0 0">${escapeHtml(s.topic)} <span style="color:#9ca3af;font-weight:400">(${s.items.length})</span></h2>${s.items.map(item).join("")}`).join("")}
      <p style="margin:24px 0 0"><a href="${safeHref(viewUrl)}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Open in DigestBot</a></p>
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:14px">You receive this because weekly digests are on in your DigestBot settings.</p>
  </div></body></html>`;
}
