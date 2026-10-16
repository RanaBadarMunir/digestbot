"use client";

import {
  Archive,
  BookOpenCheck,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ClientError, timeAgo } from "@/lib/client";
import { formatMinutes } from "@/lib/digest";
import type { BookmarkDTO } from "@/server/bookmarks";

type Status = "all" | "unread" | "read" | "archived";
interface ListResponse {
  items: BookmarkDTO[];
  total: number;
  page: number;
  pageSize: number;
  topics: Array<{ topic: string; count: number }>;
  stats: { unread: number; unreadMinutes: number; thisWeek: number; pending: number; total: number };
}

const SAMPLE_LINKS = [
  "https://paulgraham.com/hwh.html",
  "https://martinfowler.com/bliki/TechnicalDebt.html",
  "https://en.wikipedia.org/wiki/Large_language_model",
];

const PRIORITY = {
  1: { label: "Worth a full read", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  2: { label: "Normal", cls: "bg-slate-50 text-slate-600 border-slate-200" },
  3: { label: "Skim", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
} as const;

export function LibraryView() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const processing = useRef(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q: query, status, topic, page: String(page), pageSize: "20" });
    try {
      const res = await api<ListResponse>(`/api/bookmarks?${params}`);
      setData(res);
      setSelected((s) => new Set([...s].filter((id) => res.items.some((i) => i.id === id))));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, status, topic, page]);

  useEffect(() => {
    load();
  }, [load]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQuery(q);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // while links are still being summarised, nudge the server and refresh
  const pending = data?.stats.pending ?? 0;
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(async () => {
      if (processing.current) return;
      processing.current = true;
      try {
        await api("/api/bookmarks/process", { method: "POST" });
        await load();
      } catch {
        /* ignore; next tick retries */
      } finally {
        processing.current = false;
      }
    }, 4000);
    return () => clearInterval(t);
  }, [pending, load]);

  async function save(link: string) {
    const res = await api<{ duplicate: boolean }>("/api/bookmarks", { method: "POST", json: { url: link } });
    return res.duplicate;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    try {
      const duplicate = await save(url.trim());
      if (duplicate) toast.info("Already in your library");
      else toast.success("Saved — summarising it now…");
      setUrl("");
      setPage(1);
      await load();
    } catch (err) {
      toast.error(err instanceof ClientError ? err.message : "Couldn't save that link");
    } finally {
      setSaving(false);
    }
  }

  async function addSamples() {
    setSaving(true);
    try {
      for (const link of SAMPLE_LINKS) await save(link);
      toast.success("Added 3 sample links — summaries are on the way");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, action: "read" | "unread" | "archived" | "delete" | "resummarize") {
    try {
      if (action === "delete") {
        await api(`/api/bookmarks/${id}`, { method: "DELETE" });
        toast.success("Deleted");
      } else if (action === "resummarize") {
        toast.loading("Re-reading the page…", { id });
        await api(`/api/bookmarks/${id}/resummarize`, { method: "POST" });
        toast.success("Summary refreshed", { id });
      } else {
        await api(`/api/bookmarks/${id}`, { method: "PATCH", json: { status: action } });
        toast.success(action === "read" ? "Marked as read" : action === "unread" ? "Marked as unread" : "Archived");
      }
      await load();
    } catch (err) {
      toast.error((err as Error).message, { id: action === "resummarize" ? id : undefined });
    }
  }

  async function batch(action: "read" | "unread" | "archive" | "delete") {
    const ids = [...selected];
    if (action === "delete" && !confirm(`Delete ${ids.length} bookmark${ids.length > 1 ? "s" : ""}? This can't be undone.`)) return;
    try {
      const { updated } = await api<{ updated: number }>("/api/bookmarks/batch", { method: "POST", json: { ids, action } });
      toast.success(`${updated} bookmark${updated === 1 ? "" : "s"} updated`);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const items = data?.items ?? [];
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const isEmptyLibrary = data && data.stats.total === 0;

  return (
    <div className="space-y-6">
      <form onSubmit={onSave} className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <label htmlFor="new-url" className="sr-only">
          Link to save
        </label>
        <input
          id="new-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a link to an article, tweet or blog…"
          className="input border-transparent bg-slate-50 py-3 text-base focus:bg-white"
          inputMode="url"
          autoComplete="off"
        />
        <button className="btn btn-primary shrink-0 py-3" disabled={saving || !url.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Save link
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Unread" value={data?.stats.unread ?? "–"} />
        <Stat label="Time to read them all" value={data ? formatMinutes(data.stats.unreadMinutes) : "–"} />
        <Stat label="Saved this week" value={data?.stats.thisWeek ?? "–"} />
        <Link href="/app/digests" className="card group flex flex-col justify-between bg-brand-600 p-4 text-white hover:bg-brand-700">
          <span className="text-xs font-medium text-brand-100">Your digest</span>
          <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4" /> Read this week’s digest →
          </span>
        </Link>
      </div>

      {isEmptyLibrary ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <BookOpenCheck className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Your library is empty</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Paste your first link above, get the{" "}
            <Link href="/app/extension" className="font-medium text-brand-600 hover:underline">
              browser extension
            </Link>{" "}
            for one-click saving, import your bookmarks in{" "}
            <Link href="/app/settings" className="font-medium text-brand-600 hover:underline">
              Settings
            </Link>
            , or try DigestBot with a few sample articles.
          </p>
          <button onClick={addSamples} className="btn btn-secondary mt-5" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Add 3 sample links
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <label htmlFor="search" className="sr-only">
                Search
              </label>
              <input id="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, summaries, tags…" className="input pl-10" />
            </div>
            <div className="flex rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="Status">
              {(["all", "unread", "read", "archived"] as Status[]).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={status === s}
                  onClick={() => {
                    setStatus(s);
                    setPage(1);
                  }}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
                    status === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {data && data.topics.length > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              <button
                onClick={() => {
                  setTopic("");
                  setPage(1);
                }}
                className={`chip ${!topic ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
              >
                All topics
              </button>
              {data.topics.map((t) => (
                <button
                  key={t.topic}
                  onClick={() => {
                    setTopic(t.topic === topic ? "" : t.topic);
                    setPage(1);
                  }}
                  className={`chip ${topic === t.topic ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                >
                  {t.topic} <span className="opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex min-h-9 flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-brand-600"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
              />
              {selected.size ? `${selected.size} selected` : "Select all"}
            </label>
            {selected.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-secondary btn-sm" onClick={() => batch("read")}>
                  <Check className="h-3.5 w-3.5" /> Mark read
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => batch("unread")}>
                  <RotateCcw className="h-3.5 w-3.5" /> Mark unread
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => batch("archive")}>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
                <button className="btn btn-sm border border-rose-200 bg-white text-rose-600 hover:bg-rose-50" onClick={() => batch("delete")}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
            {data && <span className="ml-auto text-sm text-slate-500">{data.total} links</span>}
          </div>

          <ul className="space-y-3">
            {loading && !data && Array.from({ length: 3 }, (_, i) => <li key={i} className="card h-36 animate-pulse bg-slate-100/60" />)}
            {items.map((b) => (
              <BookmarkCard
                key={b.id}
                b={b}
                selected={selected.has(b.id)}
                onSelect={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    if (n.has(b.id)) n.delete(b.id);
                    else n.add(b.id);
                    return n;
                  })
                }
                onAction={(a) => act(b.id, a)}
              />
            ))}
            {data && items.length === 0 && (
              <li className="card px-6 py-12 text-center text-sm text-slate-500">No links match these filters.</li>
            )}
          </ul>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {pages}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function BookmarkCard({
  b,
  selected,
  onSelect,
  onAction,
}: {
  b: BookmarkDTO;
  selected: boolean;
  onSelect: () => void;
  onAction: (a: "read" | "unread" | "archived" | "delete" | "resummarize") => void;
}) {
  const [open, setOpen] = useState(false);
  const p = PRIORITY[(b.priority as 1 | 2 | 3) ?? 2];
  const pending = b.summarySource === "pending";
  return (
    <li className={`card p-4 transition sm:p-5 ${selected ? "ring-2 ring-brand-500" : ""} ${b.status === "read" ? "opacity-80" : ""}`}>
      <div className="flex gap-3">
        <input type="checkbox" checked={selected} onChange={onSelect} className="mt-1.5 h-4 w-4 shrink-0 rounded accent-brand-600" aria-label={`Select ${b.title}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {!pending && <span className={`chip ${p.cls}`}>{p.label}</span>}
            {!pending && <span className="chip border-brand-100 bg-brand-50 text-brand-700">{b.topic}</span>}
            {b.status !== "unread" && <span className="chip border-slate-200 bg-slate-100 capitalize text-slate-600">{b.status}</span>}
            <span className="truncate">{b.siteName}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock3 className="h-3 w-3" /> {b.readingMinutes} min
            </span>
            <span>·</span>
            <span>{timeAgo(b.createdAt)}</span>
          </div>
          <a
            href={b.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1.5 flex items-start gap-1.5 text-base leading-snug font-semibold text-slate-900 hover:text-brand-700"
          >
            <span className="break-words">{b.title}</span>
            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
          </a>

          {pending ? (
            <div className="mt-3 space-y-2" aria-live="polite">
              <p className="flex items-center gap-2 text-sm text-brand-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading and summarising…
              </p>
              <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            </div>
          ) : b.summarySource === "failed" ? (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {b.error ?? "We couldn't read this page."}
            </p>
          ) : (
            <>
              {b.summary && <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.summary}</p>}
              {b.keyPoints.length > 0 && (
                <>
                  <button onClick={() => setOpen(!open)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline" aria-expanded={open}>
                    {open ? "Hide" : "Show"} {b.keyPoints.length} key points <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {b.keyPoints.map((k) => (
                        <li key={k}>{k}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {b.tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {b.tags.map((t) => (
                    <span key={t} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
            {b.status === "read" ? (
              <IconButton label="Mark unread" onClick={() => onAction("unread")} icon={RotateCcw} />
            ) : (
              <IconButton label="Mark read" onClick={() => onAction("read")} icon={Check} />
            )}
            {!pending && <IconButton label="Re-summarise" onClick={() => onAction("resummarize")} icon={RefreshCw} />}
            {b.status !== "archived" ? (
              <IconButton label="Archive" onClick={() => onAction("archived")} icon={Archive} />
            ) : (
              <IconButton label="Restore" onClick={() => onAction("unread")} icon={RotateCcw} />
            )}
            <IconButton
              label="Delete"
              danger
              onClick={() => {
                if (confirm("Delete this bookmark?")) onAction("delete");
              }}
              icon={Trash2}
            />
            {b.summarySource === "ai" && (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
                <Sparkles className="h-3 w-3" /> AI summary
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function IconButton({ label, onClick, icon: Icon, danger }: { label: string; onClick: () => void; icon: React.ElementType; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`btn btn-ghost btn-sm ${danger ? "hover:bg-rose-50 hover:text-rose-600" : ""}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
