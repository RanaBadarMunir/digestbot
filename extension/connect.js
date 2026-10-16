// Content script, injected only on DigestBot's own /app/extension page (see manifest "matches").
// It tells the page the extension is installed and passes the token the page creates to the
// service worker. Page and content script talk through window.postMessage on the same origin.
(() => {
  const version = chrome.runtime.getManifest().version;
  const reply = (data) => window.postMessage({ source: "digestbot-extension", version, ...data }, location.origin);

  document.documentElement.dataset.digestbotExtension = version;
  reply({ type: "hello" });

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const msg = event.data;
    if (!msg || msg.source !== "digestbot-page") return;

    if (msg.type === "ping") reply({ type: "hello" });

    if (msg.type === "connect" && typeof msg.token === "string") {
      try {
        const res = await chrome.runtime.sendMessage({ type: "connect", token: msg.token });
        reply(res?.ok ? { type: "connected", email: res.email } : { type: "connect-failed", error: res?.error ?? "Unknown error" });
      } catch (err) {
        reply({ type: "connect-failed", error: String(err?.message ?? err) });
      }
    }
  });
})();
