import { describe, expect, it } from "vitest";
import {
  buildDigest,
  type DigestSourceItem,
  escapeHtml,
  formatMinutes,
  formatPeriod,
  periodEnding,
  rankItems,
  renderDigestEmail,
  templateIntro,
} from "@/lib/digest";

let n = 0;
function item(over: Partial<DigestSourceItem> = {}): DigestSourceItem {
  n++;
  return {
    id: `id-${n}`,
    url: `https://www.site${n}.com/post`,
    title: `Post ${n}`,
    siteName: null,
    summary: `Summary ${n}`,
    excerpt: null,
    keyPoints: ["a", "b", "c", "d"],
    topic: "Web Development",
    readingMinutes: 5,
    priority: 2,
    status: "unread",
    createdAt: new Date(2026, 9, 10 + (n % 5)),
    ...over,
  };
}

const period = { periodStart: "2026-10-10", periodEnd: "2026-10-16" };

describe("formatting", () => {
  it("formats minutes", () => {
    expect(formatMinutes(5)).toBe("5 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(95)).toBe("1 h 35 min");
  });
  it("formats periods within a month, across months and across years", () => {
    expect(formatPeriod("2026-10-10", "2026-10-16")).toBe("10–16 Oct 2026");
    expect(formatPeriod("2026-09-28", "2026-10-04")).toBe("28 Sep – 4 Oct 2026");
    expect(formatPeriod("2026-12-29", "2027-01-04")).toBe("29 Dec 2026 – 4 Jan 2027");
  });
  it("computes a 7-day inclusive period", () => {
    const p = periodEnding(new Date("2026-10-16T12:00:00Z"), 7);
    expect(p.periodStart).toBe("2026-10-10");
    expect(p.periodEnd).toBe("2026-10-16");
    expect(p.start.toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });
  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("rankItems", () => {
  it("orders by priority, then unread first, then newest", () => {
    const a = item({ priority: 2, status: "read", createdAt: new Date(2026, 1, 3) });
    const b = item({ priority: 1, createdAt: new Date(2026, 1, 1) });
    const c = item({ priority: 2, status: "unread", createdAt: new Date(2026, 1, 1) });
    const d = item({ priority: 2, status: "unread", createdAt: new Date(2026, 1, 2) });
    expect(rankItems([a, b, c, d]).map((x) => x.id)).toEqual([b.id, d.id, c.id, a.id]);
  });
});

describe("buildDigest", () => {
  it("returns null when there is nothing to digest", () => {
    expect(buildDigest([], period)).toBeNull();
    expect(buildDigest([item({ status: "archived" })], period)).toBeNull();
  });

  it("groups by topic (largest section first, Other last), picks priority-1 unread items, and computes stats", () => {
    const items = [
      item({ topic: "Security", priority: 1, readingMinutes: 12 }),
      item({ topic: "Web Development" }),
      item({ topic: "Web Development" }),
      item({ topic: "Other" }),
      item({ topic: "Security", priority: 1, status: "read" }),
      item({ topic: "Data & Databases", status: "archived" }),
    ];
    const d = buildDigest(items, period)!;
    expect(d.content.sections.map((s) => s.topic)).toEqual(["Security", "Web Development", "Other"]);
    expect(d.content.picks.map((p) => p.id)).toEqual([items[0].id]);
    expect(d.content.stats.items).toBe(5);
    expect(d.content.stats.readingMinutes).toBe(12 + 5 * 4);
    expect(d.content.stats.minutesSaved).toBe(d.content.stats.readingMinutes - d.content.stats.digestMinutes);
    expect(d.content.stats.topics).toBe(3);
    expect(d.itemIds).toHaveLength(5);
    expect(d.title).toBe("Your weekly digest · 10–16 Oct 2026");
    expect(d.content.sections[0].items[0].keyPoints).toHaveLength(3);
    expect(d.content.sections[1].items[0].siteName).toMatch(/^site\d+\.com$/);
  });

  it("falls back to the longest unread read when no item is priority 1", () => {
    const long = item({ readingMinutes: 20 });
    const d = buildDigest([item(), long, item({ readingMinutes: 3 })], period)!;
    expect(d.content.picks.map((p) => p.id)).toEqual([long.id]);
  });

  it("caps the number of items", () => {
    const d = buildDigest(Array.from({ length: 50 }, () => item()), period, 30)!;
    expect(d.content.stats.items).toBe(30);
  });

  it("uses excerpt, then placeholder, when there is no summary", () => {
    const d = buildDigest([item({ summary: null, excerpt: "From excerpt" }), item({ summary: null, excerpt: null })], period)!;
    const summaries = d.content.sections.flatMap((s) => s.items.map((i) => i.summary));
    expect(summaries).toContain("From excerpt");
    expect(summaries.some((s) => s.startsWith("No summary"))).toBe(true);
  });

  it("writes a template intro that mentions the top topics", () => {
    const d = buildDigest([item({ topic: "Security" }), item({ topic: "Security" }), item({ topic: "Web Development" })], period)!;
    expect(d.intro).toMatch(/^This week you saved 3 links — mostly about Security and Web Development\./);
    expect(templateIntro({ items: 1, readingMinutes: 4, digestMinutes: 1, minutesSaved: 3, topics: 1 }, [{ topic: "AI", items: [] }], 1)).toMatch(
      /1 link — mostly about AI.*One of them/,
    );
  });
});

describe("renderDigestEmail", () => {
  it("renders escaped, link-safe HTML", () => {
    const d = buildDigest([item({ title: `<script>alert(1)</script>`, priority: 1 }), item({ url: "https://ok.com/" })], period)!;
    d.content.sections[0].items[0].url = "javascript:alert(1)";
    const html = renderDigestEmail(d, "https://app.test/app/digests/1");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("Worth a full read");
    expect(html).toContain("https://app.test/app/digests/1");
  });
});
