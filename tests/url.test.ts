import { describe, expect, it } from "vitest";
import { assertPublicUrl, hashUrl, isPrivateAddress, normalizeUrl, siteNameFromUrl, UnsafeUrlError } from "@/lib/url";

describe("normalizeUrl", () => {
  it("adds https, lower-cases host, strips tracking params, fragment and trailing slash", () => {
    expect(normalizeUrl("Example.COM/Blog/Post/?utm_source=x&b=2&a=1&fbclid=abc#section")).toBe("https://example.com/Blog/Post?a=1&b=2");
  });
  it("drops default ports", () => {
    expect(normalizeUrl("https://example.com:443/x")).toBe("https://example.com/x");
    expect(normalizeUrl("http://example.com:80/")).toBe("http://example.com/");
  });
  it("treats equivalent URLs as duplicates", () => {
    expect(hashUrl(normalizeUrl("https://a.com/x?utm_medium=1"))).toBe(hashUrl(normalizeUrl("https://A.com/x/#top")));
  });
  it("rejects non-http schemes, credentials and junk", () => {
    expect(() => normalizeUrl("javascript:alert(1)")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl("ftp://example.com/file")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl("https://user:pass@example.com")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl("not a url")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl("https://intranet/")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl(`https://example.com/${"a".repeat(2100)}`)).toThrow(UnsafeUrlError);
  });
  it("hashes to 64 hex chars", () => {
    expect(hashUrl("https://example.com/")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isPrivateAddress (SSRF guard)", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.5.4",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("assertPublicUrl", () => {
  const resolver = (map: Record<string, string[]>) => async (h: string) => map[h] ?? [];
  it("allows hosts that resolve to public addresses", async () => {
    await expect(assertPublicUrl("https://example.com/x", resolver({ "example.com": ["93.184.216.34"] }))).resolves.toBeUndefined();
  });
  it("blocks hosts that resolve to private addresses (DNS-based SSRF)", async () => {
    await expect(assertPublicUrl("https://evil.test/", resolver({ "evil.test": ["93.184.216.34", "10.0.0.5"] }))).rejects.toThrow(UnsafeUrlError);
  });
  it("blocks literal private IPs and localhost names", async () => {
    await expect(assertPublicUrl("http://127.0.0.1:8080/admin")).rejects.toThrow(/Private/);
    await expect(assertPublicUrl("http://[::1]/")).rejects.toThrow(/Private/);
    await expect(assertPublicUrl("http://localhost/")).rejects.toThrow(/Private/);
    await expect(assertPublicUrl("http://metadata.google.internal/")).rejects.toThrow(/Private/);
  });
  it("fails on unresolvable hosts and bad protocols", async () => {
    await expect(assertPublicUrl("https://nope.example/", resolver({}))).rejects.toThrow(/could not be found/);
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(UnsafeUrlError);
  });
});

describe("siteNameFromUrl", () => {
  it("strips www", () => expect(siteNameFromUrl("https://www.example.com/a")).toBe("example.com"));
  it("returns input when invalid", () => expect(siteNameFromUrl("??")).toBe("??"));
});
