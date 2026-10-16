import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";

const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref_src|ref_url|_hsenc|_hsmi|si)$/i;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Canonical form used for duplicate detection: lower-case host, no fragment,
 * no tracking parameters, no default port, no trailing slash on non-root paths.
 */
export function normalizeUrl(input: string): string {
  const raw = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid link.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https links can be saved.");
  }
  if (u.username || u.password) throw new UnsafeUrlError("Links with embedded credentials are not allowed.");
  if (!u.hostname.includes(".") && !net.isIP(u.hostname.replace(/^\[|\]$/g, ""))) {
    throw new UnsafeUrlError("That doesn't look like a public website.");
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  }
  u.searchParams.sort();
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
  const out = u.toString();
  if (out.length > 2048) throw new UnsafeUrlError("That link is too long.");
  return out;
}

export function hashUrl(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** True for loopback, private, link-local, CGNAT, multicast, reserved and cloud-metadata ranges. */
export function isPrivateAddress(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, "");
  if (net.isIPv4(addr)) {
    const n = ipv4ToInt(addr);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (net.isIPv6(addr)) {
    const lower = addr.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(lower)) {
      const [hi, lo] = lower.slice(7).split(":").map((h) => parseInt(h, 16));
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower) || lower.startsWith("64:ff9b:") || lower.startsWith("2001:db8");
  }
  return true;
}

export type Resolver = (hostname: string) => Promise<string[]>;

const defaultResolver: Resolver = async (hostname) => (await lookup(hostname, { all: true })).map((r) => r.address);

/** Throws UnsafeUrlError unless every address the host resolves to is public (SSRF defence). */
export async function assertPublicUrl(url: string, resolve: Resolver = defaultResolver): Promise<void> {
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new UnsafeUrlError("Unsupported protocol.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("Private network addresses are not allowed.");
  }
  const addresses = net.isIP(host) ? [host] : await resolve(host).catch(() => [] as string[]);
  if (addresses.length === 0) throw new UnsafeUrlError("That website could not be found.");
  if (addresses.some(isPrivateAddress)) throw new UnsafeUrlError("Private network addresses are not allowed.");
}

export function siteNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
