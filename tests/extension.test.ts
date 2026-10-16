import { describe, expect, it } from "vitest";
// Plain-JS module shipped inside the browser extension; its pure helpers need no browser APIs.
import { chunk, DEFAULT_SERVER, flattenBookmarkTree, hostOf, isSaveableUrl, normalizeServer } from "../extension/lib.js";

describe("extension: normalizeServer", () => {
  it("defaults to the production server", () => {
    expect(normalizeServer("")).toBe(DEFAULT_SERVER);
    expect(normalizeServer(undefined)).toBe(DEFAULT_SERVER);
  });
  it("adds https and strips paths", () => {
    expect(normalizeServer("digest.example.com/app/settings")).toBe("https://digest.example.com");
    expect(normalizeServer(" https://Digest.Example.com/ ")).toBe("https://digest.example.com");
  });
  it("allows plain http only for localhost", () => {
    expect(normalizeServer("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeServer("http://127.0.0.1:3000/x")).toBe("http://127.0.0.1:3000");
    expect(() => normalizeServer("http://digest.example.com")).toThrow(/https/);
    expect(() => normalizeServer("ftp://digest.example.com")).toThrow();
    expect(() => normalizeServer("not a url at all")).toThrow();
  });
});

describe("extension: isSaveableUrl", () => {
  it.each(["https://example.com/post", "http://blog.example.org/a?b=c", "http://localhost:3000/x"])("accepts %s", (u) =>
    expect(isSaveableUrl(u)).toBe(true),
  );
  it.each(["chrome://extensions", "edge://settings", "chrome-extension://abc/popup.html", "file:///C:/x.html", "about:blank", "ftp://localhost/x", "", "nope"])(
    "rejects %s",
    (u) => expect(isSaveableUrl(u)).toBe(false),
  );
});

describe("extension: flattenBookmarkTree", () => {
  it("keeps unique http(s) bookmarks from nested folders and skips folders and other schemes", () => {
    const tree = [
      {
        id: "0",
        title: "",
        children: [
          {
            id: "1",
            title: "Bookmarks bar",
            children: [
              { id: "10", title: "Postgres tips", url: "https://example.com/pg" },
              { id: "11", title: "Folder", children: [{ id: "12", title: "Deep", url: "http://deep.example.org/" }] },
              { id: "13", title: "Script", url: "javascript:alert(1)" },
            ],
          },
          { id: "2", title: "Other", children: [{ id: "20", title: "Dupe", url: "https://example.com/pg" }, { id: "21", url: "https://no-title.example.com" }] },
        ],
      },
    ];
    expect(flattenBookmarkTree(tree)).toEqual([
      { url: "https://example.com/pg", title: "Postgres tips" },
      { url: "http://deep.example.org/", title: "Deep" },
      { url: "https://no-title.example.com", title: "" },
    ]);
    expect(flattenBookmarkTree(undefined)).toEqual([]);
  });
});

describe("extension: small helpers", () => {
  it("chunks lists", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 500)).toEqual([]);
  });
  it("reads host names", () => {
    expect(hostOf("https://www.example.com/a")).toBe("example.com");
    expect(hostOf("??")).toBe("");
  });
});
