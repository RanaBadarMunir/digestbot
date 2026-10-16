// Shared logic for the DigestBot extension (service worker, popup and options page).
// Pure helpers at the top have no browser-API dependency and are unit-tested in tests/extension.test.ts.

export const DEFAULT_SERVER = "https://digestbot-phi.vercel.app";
export const IMPORT_CHUNK = 500;

const DEFAULTS = { server: DEFAULT_SERVER, token: null, email: null, name: null, autoSaveBookmarks: true };

/** Turns what the user typed into a server origin, or throws. Plain http only for local development. */
export function normalizeServer(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return DEFAULT_SERVER;
  let u;
  try {
    u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error("That doesn't look like a web address.");
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) {
    throw new Error("Use an https:// address (http is only allowed for localhost).");
  }
  return u.origin;
}

/** Only real web pages can be saved — not chrome://, file://, the new-tab page or extension pages. */
export function isSaveableUrl(url) {
  try {
    const u = new URL(url);
    const web = u.protocol === "http:" || u.protocol === "https:";
    return web && (u.hostname.includes(".") || u.hostname === "localhost");
  } catch {
    return false;
  }
}

/** Flattens chrome.bookmarks.getTree() output into unique http(s) links. */
export function flattenBookmarkTree(nodes) {
  const out = [];
  const seen = new Set();
  const walk = (list) => {
    for (const n of list ?? []) {
      if (n.url && /^https?:\/\//i.test(n.url) && !seen.has(n.url)) {
        seen.add(n.url);
        out.push({ url: n.url, title: (n.title ?? "").slice(0, 300) });
      }
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export class NotConnectedError extends Error {
  constructor(message = "This browser isn't connected to DigestBot yet.") {
    super(message);
    this.name = "NotConnectedError";
  }
}

// ---- Browser-API helpers (chrome.* is only touched when these run) ----

export async function getConfig() {
  return chrome.storage.local.get(DEFAULTS);
}

export async function setConfig(patch) {
  await chrome.storage.local.set(patch);
}

/** Calls the DigestBot API with the stored bearer token. */
export async function api(path, { method = "GET", body, token, server } = {}) {
  const cfg = token && server ? { token, server } : await getConfig();
  if (!cfg.token) throw new NotConnectedError();
  let res;
  try {
    res = await fetch(`${cfg.server}${path}`, {
      method,
      headers: { authorization: `Bearer ${cfg.token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Can't reach ${hostOf(cfg.server) || cfg.server}. Check your connection.`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new NotConnectedError("Your DigestBot connection has expired. Connect again.");
  if (!res.ok) throw new Error(data?.error?.message ?? `DigestBot answered with an error (${res.status}).`);
  return data;
}

export function saveLink({ url, title }) {
  return api("/api/bookmarks", { method: "POST", body: { url, ...(title ? { title: title.slice(0, 300) } : {}) } });
}

/** Sends every browser bookmark to DigestBot in chunks; `onProgress(done, total)` after each chunk. */
export async function importAllBookmarks(onProgress = () => {}) {
  const links = flattenBookmarkTree(await chrome.bookmarks.getTree());
  const totals = { found: links.length, imported: 0, duplicates: 0, skipped: 0 };
  let done = 0;
  for (const part of chunk(links, IMPORT_CHUNK)) {
    const r = await api("/api/bookmarks/import-links", { method: "POST", body: { links: part } });
    totals.imported += r.imported;
    totals.duplicates += r.duplicates;
    totals.skipped += r.skipped;
    done += part.length;
    onProgress(done, links.length);
  }
  return totals;
}

/** Asks for permission to talk to a server that isn't built into the manifest. */
export async function ensureServerPermission(server) {
  const origins = [`${server}/*`];
  if (await chrome.permissions.contains({ origins })) return true;
  return chrome.permissions.request({ origins });
}
