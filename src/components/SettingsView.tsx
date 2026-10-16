"use client";

import { Bookmark, Download, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ClientError } from "@/lib/client";

interface SettingsResponse {
  user: { name: string; email: string; digestWeekday: number; emailDigest: boolean };
  features: { ai: boolean; email: boolean };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-5 p-5 sm:p-6 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const router = useRouter();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const bookmarklet = useRef<HTMLAnchorElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<SettingsResponse>("/api/settings")
      .then(setData)
      .catch((e) => toast.error(e.message));
    setOrigin(window.location.origin);
  }, []);

  // React blocks javascript: URLs in JSX, so set the bookmarklet href directly.
  useEffect(() => {
    if (!origin || !bookmarklet.current) return;
    const code = `javascript:(()=>{window.open('${origin}/save?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'digestbot','width=440,height=340')})()`;
    bookmarklet.current.setAttribute("href", code);
  }, [origin, data]);

  async function patch(body: Partial<SettingsResponse["user"]>, label: string) {
    setBusy(label);
    try {
      const { user } = await api<{ user: SettingsResponse["user"] }>("/api/settings", { method: "PATCH", json: body });
      setData((d) => (d ? { ...d, user } : d));
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onImport() {
    const file = fileInput.current?.files?.[0];
    if (!file) return toast.error("Choose your exported bookmarks .html file first");
    setBusy("import");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api<{ imported: number; duplicates: number; skipped: number }>("/api/bookmarks/import", { method: "POST", body: form });
      toast.success(`Imported ${r.imported} links${r.duplicates ? ` · ${r.duplicates} already saved` : ""}${r.skipped ? ` · ${r.skipped} skipped` : ""}`);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy("password");
    try {
      await api("/api/settings/password", { method: "POST", json: Object.fromEntries(new FormData(form)) });
      toast.success("Password changed");
      form.reset();
    } catch (err) {
      toast.error(err instanceof ClientError ? (Object.values(err.fields ?? {})[0] ?? err.message) : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    const password = prompt("This permanently deletes your account, bookmarks and digests.\n\nEnter your password to confirm:");
    if (!password) return;
    setBusy("delete");
    try {
      await api("/api/account", { method: "DELETE", json: { password } });
      toast.success("Your account has been deleted");
      router.replace("/");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  if (!data) return <div className="card h-64 animate-pulse bg-slate-100/60" />;
  const { user, features } = data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
      </div>

      <Section title="Profile">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            patch({ name: String(new FormData(e.currentTarget).get("name")) }, "name");
          }}
        >
          <div className="flex-1">
            <label htmlFor="name" className="label">
              Display name
            </label>
            <input id="name" name="name" defaultValue={user.name} className="input" maxLength={80} required />
          </div>
          <button className="btn btn-secondary" disabled={busy === "name"}>
            Save
          </button>
        </form>
      </Section>

      <Section title="Weekly digest" description="When your digest is compiled and whether it's emailed to you.">
        <div className="space-y-4">
          <div>
            <label htmlFor="weekday" className="label">
              Digest day
            </label>
            <select
              id="weekday"
              className="input sm:w-60"
              value={user.digestWeekday}
              onChange={(e) => patch({ digestWeekday: Number(e.target.value) }, "weekday")}
              disabled={busy === "weekday"}
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Digests are compiled each morning (07:00 UTC) on the chosen day.</p>
          </div>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-600"
              checked={user.emailDigest}
              onChange={(e) => patch({ emailDigest: e.target.checked }, "email")}
              disabled={busy === "email"}
            />
            <span className="text-sm">
              <span className="font-medium">Email me my digest</span>
              {!features.email && <span className="block text-xs text-amber-700">Email delivery isn’t configured on this server yet — digests appear in the app.</span>}
            </span>
          </label>
          <p className="text-xs text-slate-500">
            Summaries: {features.ai ? "Gemini AI (with offline fallback)" : "offline extractive summariser (no AI key configured)"}.
          </p>
        </div>
      </Section>

      <Section title="One-click capture" description="Save any page you're reading without opening DigestBot.">
        <div className="space-y-3 text-sm text-slate-600">
          <p>Drag this button to your bookmarks bar, then click it on any page:</p>
          <a
            ref={bookmarklet}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              toast.info("Drag the button to your bookmarks bar instead of clicking it here.");
            }}
            className="btn btn-primary cursor-grab"
          >
            <Bookmark className="h-4 w-4" /> Save to DigestBot
          </a>
          <p>
            On mobile, share any link to this address:{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs break-all">{origin}/save?url=…</code>
          </p>
        </div>
      </Section>

      <Section title="Import bookmarks" description="Bring in your existing browser bookmarks (HTML export, up to 500 links).">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Chrome/Edge: <em>Bookmarks → Bookmark manager → ⋮ → Export bookmarks</em>. Firefox: <em>Bookmarks → Manage → Import and Backup → Export to HTML</em>.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={fileInput}
              type="file"
              accept=".html,.htm,text/html"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
            />
            <button className="btn btn-secondary shrink-0" onClick={onImport} disabled={busy === "import"}>
              {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import
            </button>
          </div>
        </div>
      </Section>

      <Section title="Password">
        <form onSubmit={onPassword} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="currentPassword" className="label">
              Current password
            </label>
            <input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
          </div>
          <div>
            <label htmlFor="newPassword" className="label">
              New password
            </label>
            <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" minLength={8} required />
          </div>
          <button className="btn btn-secondary" disabled={busy === "password"}>
            Change
          </button>
        </form>
      </Section>

      <Section title="Your data" description="Download everything, or delete your account permanently.">
        <div className="flex flex-wrap gap-3">
          <a href="/api/account/export" className="btn btn-secondary">
            <Download className="h-4 w-4" /> Export my data (JSON)
          </a>
          <button className="btn btn-danger" onClick={onDelete} disabled={busy === "delete"}>
            Delete account
          </button>
        </div>
      </Section>
    </div>
  );
}
