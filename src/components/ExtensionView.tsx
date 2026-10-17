"use client";

import { CheckCircle2, Copy, Download, Keyboard, Loader2, MousePointerClick, Puzzle, Star, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, timeAgo } from "@/lib/client";
import type { TokenDTO } from "@/server/tokens";

type Detect = "checking" | "found" | "missing";
type Phase = "idle" | "connecting" | "connected";

function browserName(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if ((navigator as Navigator & { brave?: unknown }).brave) return "Brave";
  if (/Firefox\//.test(ua)) return "Firefox";
  return "Chrome";
}

const FEATURES = [
  { icon: MousePointerClick, title: "One click", body: "Click the DigestBot icon on any article — it’s saved and summarised." },
  { icon: Keyboard, title: "Shortcut", body: "Alt + Shift + S saves the page without touching the mouse." },
  { icon: Puzzle, title: "Right-click", body: "“Save link to DigestBot” on any link, without opening it." },
  { icon: Star, title: "Browser ★ bookmarks", body: "Pages you star in the browser go to DigestBot too, and you can import all existing ones." },
];

export function ExtensionView({ fromExtension }: { fromExtension: boolean }) {
  const [detect, setDetect] = useState<Detect>("checking");
  const [version, setVersion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [connectedAs, setConnectedAs] = useState("");
  const [code, setCode] = useState("");
  const [tokens, setTokens] = useState<TokenDTO[] | null>(null);
  const pending = useRef<{ resolve: (v: { ok: boolean; email?: string; error?: string }) => void } | null>(null);

  const loadTokens = useCallback(() => {
    api<{ items: TokenDTO[] }>("/api/tokens")
      .then((r) => setTokens(r.items))
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    loadTokens();
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const msg = event.data as { source?: string; type?: string; version?: string; email?: string; error?: string };
      if (msg?.source !== "digestbot-extension") return;
      if (msg.type === "hello") {
        setDetect("found");
        setVersion(msg.version ?? "");
      }
      if (msg.type === "connected") pending.current?.resolve({ ok: true, email: msg.email });
      if (msg.type === "connect-failed") pending.current?.resolve({ ok: false, error: msg.error });
    };
    window.addEventListener("message", onMessage);
    const existing = document.documentElement.dataset.digestbotExtension;
    if (existing) {
      setDetect("found");
      setVersion(existing);
    }
    window.postMessage({ source: "digestbot-page", type: "ping" }, window.location.origin);
    const t = setTimeout(() => setDetect((d) => (d === "checking" ? "missing" : d)), 1500);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(t);
    };
  }, [loadTokens]);

  async function connect() {
    setPhase("connecting");
    try {
      const { token } = await api<{ token: string }>("/api/tokens", { method: "POST", json: { name: `${browserName()} extension` } });
      const result = await new Promise<{ ok: boolean; email?: string; error?: string }>((resolve) => {
        pending.current = { resolve };
        window.postMessage({ source: "digestbot-page", type: "connect", token }, window.location.origin);
        setTimeout(() => resolve({ ok: false, error: "The extension didn’t answer. Reload this page and try again." }), 10000);
      });
      pending.current = null;
      if (!result.ok) throw new Error(result.error);
      setConnectedAs(result.email ?? "");
      setPhase("connected");
      toast.success("This browser is connected");
      loadTokens();
    } catch (err) {
      setPhase("idle");
      toast.error((err as Error).message);
      loadTokens();
    }
  }

  async function makeCode() {
    try {
      const { token } = await api<{ token: string }>("/api/tokens", { method: "POST", json: { name: `${browserName()} extension (code)` } });
      setCode(token);
      loadTokens();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Disconnect this browser? It will stop saving to DigestBot.")) return;
    try {
      await api(`/api/tokens/${id}`, { method: "DELETE" });
      toast.success("Disconnected");
      loadTokens();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Browser extension</h1>
        <p className="mt-1 text-sm text-slate-500">Save any page to DigestBot in one click — for Chrome, Edge, Brave and Opera.</p>
      </div>

      {/* Connect panel */}
      <section className="card p-5 sm:p-6" aria-live="polite">
        {detect === "checking" ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Looking for the extension…
          </p>
        ) : phase === "connected" ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <h2 className="font-semibold">Connected{connectedAs ? ` as ${connectedAs}` : ""}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Open any article and click the DigestBot icon in your toolbar (pin it from the puzzle-piece menu), or press{" "}
                <kbd className="rounded border border-slate-300 px-1 text-xs">Alt</kbd>+<kbd className="rounded border border-slate-300 px-1 text-xs">Shift</kbd>+
                <kbd className="rounded border border-slate-300 px-1 text-xs">S</kbd>. You can close this tab.
              </p>
            </div>
          </div>
        ) : detect === "found" ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Extension found{version ? ` (v${version})` : ""}</h2>
              <p className="mt-1 text-sm text-slate-600">Connect it to your account once. It gets a key that can only save links — never your password.</p>
            </div>
            <button className="btn btn-primary shrink-0" onClick={connect} disabled={phase === "connecting"}>
              {phase === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Puzzle className="h-4 w-4" />} Connect this browser
            </button>
          </div>
        ) : (
          <div>
            <h2 className="font-semibold">{fromExtension ? "Reload this page to finish connecting" : "Install the extension"}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>
                <a href="/digestbot-extension.zip" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline" download>
                  <Download className="h-4 w-4" /> Download the extension (.zip)
                </a>{" "}
                and unzip it.
              </li>
              <li>
                Open <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">chrome://extensions</code> (Edge: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">edge://extensions</code>) and turn on <b>Developer mode</b>.
              </li>
              <li>
                Click <b>Load unpacked</b> and choose the unzipped folder — the one that has{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">manifest.json</code> directly inside it.
              </li>
              <li>The extension opens this page by itself — click <b>Connect this browser</b>.</li>
            </ol>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <b>“Manifest file is missing or unreadable”?</b> You picked a folder one level too high. Open it, find the folder
              that contains <code className="text-xs">manifest.json</code>, and choose that one with <b>Load unpacked</b>.
            </p>
            <div className="mt-5 border-t border-slate-100 pt-4">
              {code ? (
                <div>
                  <p className="text-sm text-slate-600">Your connection code (shown once). Paste it in the extension’s settings → “paste a connection code”.</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <code className="input overflow-x-auto font-mono text-xs whitespace-nowrap">{code}</code>
                    <button className="btn btn-secondary shrink-0" onClick={() => navigator.clipboard.writeText(code).then(() => toast.success("Copied"))}>
                      <Copy className="h-4 w-4" /> Copy
                    </button>
                  </div>
                </div>
              ) : (
                <button className="text-sm font-medium text-slate-500 hover:text-brand-600 hover:underline" onClick={makeCode}>
                  Using your own DigestBot server? Get a connection code instead
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-4">
            <f.icon className="h-5 w-5 text-brand-600" />
            <h3 className="mt-2 text-sm font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Upload className="h-4 w-4 text-slate-400" /> Connected browsers
        </h2>
        {tokens === null ? (
          <div className="mt-3 h-10 animate-pulse rounded bg-slate-100" />
        ) : tokens.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No browser is connected yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                <span className="font-medium text-slate-800">{t.name}</span>
                <code className="text-xs text-slate-400">{t.prefix}</code>
                <span className="text-slate-500">connected {timeAgo(t.createdAt)}</span>
                <span className="text-slate-500">{t.lastUsedAt ? `last used ${timeAgo(t.lastUsedAt)}` : "not used yet"}</span>
                <button className="btn btn-sm ml-auto border border-rose-200 bg-white text-rose-600 hover:bg-rose-50" onClick={() => revoke(t.id)}>
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
