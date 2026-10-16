/** Parses the Netscape bookmark file format exported by every major browser. */

export interface ImportedLink {
  url: string;
  title: string;
}

export const MAX_IMPORT_LINKS = 500;

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function parseBookmarksHtml(html: string, limit = MAX_IMPORT_LINKS): ImportedLink[] {
  const out: ImportedLink[] = [];
  const seen = new Set<string>();
  const re = /<a\s[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  for (let m = re.exec(html); m && out.length < limit; m = re.exec(html)) {
    const url = decodeEntities(m[2].trim());
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    const title = decodeEntities(m[3].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim().slice(0, 300);
    out.push({ url, title });
  }
  return out;
}
