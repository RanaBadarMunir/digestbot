import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { assertPublicUrl, type Resolver, siteNameFromUrl, UnsafeUrlError } from "./url";

export const MAX_BYTES = 2 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 8000;
export const MAX_REDIRECTS = 5;
export const MAX_TEXT_CHARS = 20000;

const USER_AGENT = "Mozilla/5.0 (compatible; DigestBot/1.0; +https://github.com/digestbot)";

export interface Extracted {
  title: string;
  siteName: string;
  excerpt: string;
  text: string;
}

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  resolver?: Resolver;
  timeoutMs?: number;
  maxBytes?: number;
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    buf.set(c.subarray(0, buf.length - offset), offset);
    offset += c.byteLength;
    if (offset >= buf.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

/**
 * SSRF-safe GET: validates every redirect hop against private address ranges,
 * enforces a timeout and a response size cap.
 */
export async function safeFetch(url: string, opts: FetchOptions = {}): Promise<{ url: string; body: string; contentType: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(current, opts.resolver);
      const res = await fetchImpl(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5" },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new Error(`Redirect without location (${res.status})`);
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) throw new Error(`The site responded with HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      return { url: current, body: await readCapped(res, opts.maxBytes ?? MAX_BYTES), contentType };
    }
    throw new Error("Too many redirects");
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    if ((err as Error).name === "AbortError") throw new Error("The site took too long to respond");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function meta(document: Document, ...names: string[]): string {
  for (const n of names) {
    const el = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
    const v = el?.getAttribute("content")?.trim();
    if (v) return v;
  }
  return "";
}

export function cleanText(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Pure: turn raw HTML into title / site name / excerpt / readable text. */
export function extractFromHtml(html: string, url: string): Extracted {
  const { document } = parseHTML(html);
  const title =
    meta(document as unknown as Document, "og:title", "twitter:title") || document.querySelector("title")?.textContent?.trim() || "";
  const siteName = meta(document as unknown as Document, "og:site_name") || siteNameFromUrl(url);
  const description = meta(document as unknown as Document, "og:description", "description", "twitter:description");

  let text = "";
  try {
    const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
    text = article?.textContent ? cleanText(article.textContent) : "";
  } catch {
    text = "";
  }
  if (text.length < 200) {
    const fallback = parseHTML(html).document;
    fallback.querySelectorAll("script,style,noscript,nav,header,footer,aside,form").forEach((el) => el.remove());
    const paragraphs = [...fallback.querySelectorAll("p,li,h1,h2,h3,pre,blockquote")]
      .map((el) => cleanText(el.textContent ?? ""))
      .filter((p) => p.length > 30);
    const joined = paragraphs.join("\n");
    if (joined.length > text.length) text = joined;
  }

  return {
    title: cleanText(title).slice(0, 300) || siteNameFromUrl(url),
    siteName: cleanText(siteName).slice(0, 120),
    excerpt: cleanText(description).slice(0, 500),
    text: text.slice(0, MAX_TEXT_CHARS),
  };
}

export function isTweetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)(twitter\.com|x\.com)$/.test(u.hostname) && /\/status(es)?\/\d+/.test(u.pathname);
  } catch {
    return false;
  }
}

/** X/Twitter pages need JavaScript; their public oEmbed endpoint returns the tweet text. */
export async function extractTweet(url: string, opts: FetchOptions = {}): Promise<Extracted> {
  const endpoint = `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url)}`;
  const { body } = await safeFetch(endpoint, opts);
  const data = JSON.parse(body) as { html?: string; author_name?: string };
  const { document } = parseHTML(`<html><body>${data.html ?? ""}</body></html>`);
  const p = [...document.querySelectorAll("p")].map((el) => cleanText(el.textContent ?? "")).join("\n");
  const author = data.author_name ?? "X";
  return {
    title: `${author} on X: “${p.slice(0, 90)}${p.length > 90 ? "…" : ""}”`,
    siteName: "X (Twitter)",
    excerpt: p.slice(0, 500),
    text: p,
  };
}

export async function extractUrl(url: string, opts: FetchOptions = {}): Promise<Extracted> {
  if (isTweetUrl(url)) {
    try {
      return await extractTweet(url, opts);
    } catch {
      /* fall through to a normal fetch */
    }
  }
  const res = await safeFetch(url, opts);
  if (res.contentType && !/html|xml|text\/plain/i.test(res.contentType)) {
    return { title: siteNameFromUrl(res.url), siteName: siteNameFromUrl(res.url), excerpt: "", text: "" };
  }
  if (/text\/plain/i.test(res.contentType)) {
    const text = cleanText(res.body).slice(0, MAX_TEXT_CHARS);
    return { title: text.split("\n")[0].slice(0, 200) || siteNameFromUrl(res.url), siteName: siteNameFromUrl(res.url), excerpt: "", text };
  }
  return extractFromHtml(res.body, res.url);
}
