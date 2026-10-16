import {
  api,
  DEFAULT_SERVER,
  ensureServerPermission,
  flattenBookmarkTree,
  getConfig,
  importAllBookmarks,
  normalizeServer,
  setConfig,
} from "./lib.js";

const $ = (id) => document.getElementById(id);

function message(el, text, kind = "") {
  el.textContent = text;
  el.className = `msg ${kind}`;
}

async function refresh() {
  const cfg = await getConfig();
  const connected = Boolean(cfg.token);
  $("status").textContent = connected ? "Connected" : "Not connected";
  $("status").className = `pill ${connected ? "ok" : "no"}`;
  $("who").textContent = connected
    ? `Saving to ${cfg.email} on ${new URL(cfg.server).host}.`
    : "Connect this browser to your DigestBot account. You only do this once.";
  $("connect").hidden = connected;
  $("disconnect").hidden = !connected;
  $("server").value = cfg.server === DEFAULT_SERVER ? "" : cfg.server;
  $("autoSave").checked = cfg.autoSaveBookmarks;
  $("importAll").disabled = !connected;
  const count = flattenBookmarkTree(await chrome.bookmarks.getTree()).length;
  $("importAll").textContent = `Import all my existing browser bookmarks (${count})`;
}

$("connect").addEventListener("click", async () => {
  const { server } = await getConfig();
  chrome.tabs.create({ url: `${server}/app/extension?from=extension` });
});

$("disconnect").addEventListener("click", async () => {
  try {
    await api("/api/extension/disconnect", { method: "POST" });
  } catch {
    /* already revoked on the server, or offline: still forget it here */
  }
  await setConfig({ token: null, email: null, name: null });
  message($("connMsg"), "Disconnected. The connection code was deleted.", "ok");
  refresh();
});

$("saveServer").addEventListener("click", async () => {
  try {
    const server = normalizeServer($("server").value);
    if (!(await ensureServerPermission(server))) throw new Error("Permission to reach that address was not granted.");
    const { server: old } = await getConfig();
    await setConfig(server === old ? {} : { server, token: null, email: null, name: null });
    message($("connMsg"), server === old ? "Address unchanged." : `Address saved: ${server}. Now connect.`, "ok");
    refresh();
  } catch (err) {
    message($("connMsg"), err.message, "bad");
  }
});

$("useCode").addEventListener("click", async () => {
  const token = $("code").value.trim();
  try {
    if (!/^dbt_[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("That isn’t a DigestBot connection code (it starts with dbt_).");
    const { server } = await getConfig();
    if (!(await ensureServerPermission(server))) throw new Error("Permission to reach DigestBot was not granted.");
    const { user } = await api("/api/auth/me", { token, server });
    await setConfig({ token, email: user.email, name: user.name });
    $("code").value = "";
    message($("connMsg"), `Connected as ${user.email}.`, "ok");
    refresh();
  } catch (err) {
    message($("connMsg"), err.message, "bad");
  }
});

$("autoSave").addEventListener("change", (e) => setConfig({ autoSaveBookmarks: e.target.checked }));

$("importAll").addEventListener("click", async () => {
  const btn = $("importAll");
  btn.disabled = true;
  try {
    const r = await importAllBookmarks((done, total) => message($("importMsg"), `Sending ${done} of ${total}…`));
    message(
      $("importMsg"),
      `Done: ${r.imported} new, ${r.duplicates} already saved${r.skipped ? `, ${r.skipped} skipped (not web pages)` : ""}. Summaries appear in your library over the next minutes.`,
      "ok",
    );
  } catch (err) {
    message($("importMsg"), err.message, "bad");
  } finally {
    btn.disabled = false;
  }
});

$("shortcuts").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

chrome.storage.onChanged.addListener(refresh);
refresh();
