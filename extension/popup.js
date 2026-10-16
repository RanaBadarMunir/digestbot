// Popup = the one click: opening it saves the current tab straight away.
import { api, getConfig, hostOf, isSaveableUrl, NotConnectedError, saveLink } from "./lib.js";

const view = document.getElementById("view");
document.getElementById("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function render(html) {
  view.innerHTML = html;
}

function pageCard(title, url, extra = "") {
  return `<div class="page"><div class="page-title">${esc(title || url)}</div><div class="small muted">${esc(hostOf(url))}</div>${extra}</div>`;
}

function libraryButton(server) {
  return `<a class="btn" href="${esc(server)}/app" target="_blank" rel="noopener">Open library</a>`;
}

function notConnected(server, message) {
  render(`
    <p class="status bad">Not connected</p>
    <p class="muted">${esc(message ?? "Connect this browser to your DigestBot account once, then saving is one click.")}</p>
    <div class="actions"><button class="btn btn-primary" id="connect">Connect to DigestBot</button></div>`);
  document.getElementById("connect").addEventListener("click", () => {
    chrome.tabs.create({ url: `${server}/app/extension?from=extension` });
    window.close();
  });
}

/** Polls for the summary for ~16 s; the server summarises in the background. */
async function showSummary(id, title, url) {
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let b;
    try {
      ({ bookmark: b } = await api(`/api/bookmarks/${id}`));
    } catch {
      return;
    }
    if (b.summarySource === "pending") continue;
    const chips = `<div class="chips"><span class="chip">${esc(b.topic)}</span><span class="chip">${esc(b.readingMinutes)} min read</span>${
      b.priority === 1 ? '<span class="chip">Worth a full read</span>' : ""
    }</div>`;
    const summary = b.summary ? `<p class="summary">${esc(b.summary)}</p>` : b.error ? `<p class="summary">${esc(b.error)}</p>` : "";
    view.querySelector(".page").outerHTML = pageCard(b.title || title, url, chips + summary);
    view.querySelector("#working")?.remove();
    return;
  }
}

async function main() {
  const { server, token } = await getConfig();
  if (!token) return notConnected(server);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !isSaveableUrl(tab.url)) {
    render(`<p class="status bad">Can't save this page</p><p class="muted">Only web pages (http and https) can be saved — not browser or extension pages.</p><div class="actions">${libraryButton(server)}</div>`);
    return;
  }

  render(`<p class="status"><span class="spinner"></span>Saving…</p>${pageCard(tab.title, tab.url)}`);
  try {
    const { bookmark, duplicate } = await saveLink({ url: tab.url, title: tab.title });
    render(`
      <p class="status ${duplicate ? "dup" : "ok"}">${duplicate ? "Already in your library" : "✓ Saved to DigestBot"}</p>
      ${pageCard(bookmark.title || tab.title, tab.url)}
      ${duplicate || bookmark.summarySource !== "pending" ? "" : '<p class="small muted" id="working" style="display:flex;gap:6px;align-items:center;margin-top:8px"><span class="spinner"></span>Summarising — it will be in this week’s digest.</p>'}
      <div class="actions">${libraryButton(server)}</div>`);
    if (!duplicate) showSummary(bookmark.id, tab.title, tab.url);
    else {
      const b = bookmark;
      if (b.summary) view.querySelector(".page").insertAdjacentHTML("beforeend", `<p class="summary">${esc(b.summary)}</p>`);
    }
  } catch (err) {
    if (err instanceof NotConnectedError) return notConnected(server, err.message);
    render(`<p class="status bad">Couldn’t save</p><p class="muted">${esc(err.message)}</p><div class="actions"><button class="btn btn-primary" id="retry">Try again</button>${libraryButton(server)}</div>`);
    document.getElementById("retry").addEventListener("click", main);
  }
}

main();
