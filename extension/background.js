// DigestBot extension service worker: right-click menus, saving pages you ★ in the browser,
// badge feedback, and receiving the connection token from the DigestBot website.
import { api, getConfig, isSaveableUrl, NotConnectedError, saveLink, setConfig } from "./lib.js";

const MENU_PAGE = "digestbot-save-page";
const MENU_LINK = "digestbot-save-link";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_PAGE, title: "Save page to DigestBot", contexts: ["page"] });
    chrome.contextMenus.create({ id: MENU_LINK, title: "Save link to DigestBot", contexts: ["link"] });
  });
  if (reason === "install") {
    const { server, token } = await getConfig();
    if (!token) chrome.tabs.create({ url: `${server}/app/extension?from=extension` });
  }
});

/** Small badge on the toolbar icon: "…" while saving, "✓" saved, "=" already saved, "!" failed. */
async function badge(tabId, state, message) {
  const looks = {
    saving: ["…", "#4F46E5"],
    saved: ["✓", "#15803D"],
    duplicate: ["=", "#475569"],
    error: ["!", "#B91C1C"],
  }[state];
  const target = tabId ? { tabId } : {};
  await chrome.action.setBadgeBackgroundColor({ ...target, color: looks[1] });
  await chrome.action.setBadgeText({ ...target, text: looks[0] });
  if (message) await chrome.action.setTitle({ ...target, title: `DigestBot: ${message}` });
  if (state !== "saving") {
    setTimeout(() => {
      chrome.action.setBadgeText({ ...target, text: "" });
      chrome.action.setTitle({ ...target, title: "Save to DigestBot (Alt+Shift+S)" });
    }, state === "error" ? 6000 : 2500);
  }
}

async function saveWithBadge(link, tabId) {
  if (!isSaveableUrl(link.url)) return badge(tabId, "error", "Only web pages (http/https) can be saved.");
  await badge(tabId, "saving");
  try {
    const { duplicate } = await saveLink(link);
    await badge(tabId, duplicate ? "duplicate" : "saved", duplicate ? "Already in your library" : "Saved — summarising it now");
  } catch (err) {
    await badge(tabId, "error", err.message);
    if (err instanceof NotConnectedError) {
      const { server } = await getConfig();
      chrome.tabs.create({ url: `${server}/app/extension?from=extension` });
    }
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_LINK && info.linkUrl) {
    saveWithBadge({ url: info.linkUrl, title: "" }, tab?.id); // the server reads the real title
  } else if (info.menuItemId === MENU_PAGE) {
    saveWithBadge({ url: info.pageUrl ?? tab?.url, title: tab?.title ?? "" }, tab?.id);
  }
});

// Pages bookmarked with the browser's own ★ go to DigestBot too (option, on by default).
// Bulk imports from another browser fire onCreated for every bookmark, so those are ignored.
chrome.bookmarks.onImportBegan.addListener(() => chrome.storage.session.set({ browserImporting: true }));
chrome.bookmarks.onImportEnded.addListener(() => chrome.storage.session.set({ browserImporting: false }));

chrome.bookmarks.onCreated.addListener(async (_id, node) => {
  if (!node.url) return; // a folder
  const [{ token, autoSaveBookmarks }, { browserImporting }] = await Promise.all([
    getConfig(),
    chrome.storage.session.get({ browserImporting: false }),
  ]);
  if (!token || !autoSaveBookmarks || browserImporting) return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  saveWithBadge({ url: node.url, title: node.title ?? "" }, tab?.id);
});

// The DigestBot website (via connect.js) hands over a freshly created token.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "connect" || typeof msg.token !== "string" || !sender.url) return false;
  const server = new URL(sender.url).origin;
  (async () => {
    try {
      const { user } = await api("/api/auth/me", { token: msg.token, server });
      // Reconnecting: revoke the token this browser used before, so old ones don't pile up.
      const old = await getConfig();
      if (old.token && old.token !== msg.token && old.server === server) {
        await api("/api/extension/disconnect", { method: "POST", token: old.token, server }).catch(() => {});
      }
      await setConfig({ server, token: msg.token, email: user.email, name: user.name });
      sendResponse({ ok: true, email: user.email });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true; // keep the channel open for the async reply
});
