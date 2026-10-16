"use client";

import { ChevronRight, Globe, Inbox, Loader2, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, timeAgo } from "@/lib/client";
import { type DigestStats, formatMinutes, formatPeriod } from "@/lib/digest";

interface DigestRow {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  itemCount: number;
  shared: boolean;
  emailedAt: string | null;
  createdAt: string;
  stats: DigestStats;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function DigestList() {
  const router = useRouter();
  const [items, setItems] = useState<DigestRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [weekday, setWeekday] = useState<number | null>(null);

  useEffect(() => {
    api<{ items: DigestRow[] }>("/api/digests")
      .then((r) => setItems(r.items))
      .catch((e) => toast.error(e.message));
    api<{ user: { digestWeekday: number } }>("/api/settings")
      .then((r) => setWeekday(r.user.digestWeekday))
      .catch(() => {});
  }, []);

  async function generate() {
    setBusy(true);
    try {
      const { digest } = await api<{ digest: { id: string } }>("/api/digests", { method: "POST", json: { days: 7 } });
      toast.success("Your digest is ready");
      router.push(`/app/digests/${digest.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Digests</h1>
          <p className="mt-1 text-sm text-slate-500">
            {weekday !== null ? (
              <>
                Your digest is built automatically every <strong className="text-slate-700">{WEEKDAYS[weekday]}</strong>.{" "}
                <Link href="/app/settings" className="text-brand-600 hover:underline">
                  Change day
                </Link>
              </>
            ) : (
              "Your weekly reading, summarised."
            )}
          </p>
        </div>
        <button onClick={generate} disabled={busy} className="btn btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate this week’s digest now
        </button>
      </div>

      {items === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-slate-100/60" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Inbox className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">No digests yet</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Save a few links during the week, then generate your first digest — or wait for it to arrive automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((d) => (
            <li key={d.id}>
              <Link href={`/app/digests/${d.id}`} className="card group flex items-center gap-4 p-4 transition hover:border-brand-200 sm:p-5">
                <span className="hidden h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-900 text-white sm:flex">
                  <span className="text-[10px] leading-none text-slate-300 uppercase">{formatPeriod(d.periodStart, d.periodEnd).split(" ").slice(-2, -1)}</span>
                  <span className="text-lg leading-tight font-semibold">{Number(d.periodEnd.slice(8, 10))}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">Week of {formatPeriod(d.periodStart, d.periodEnd)}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {d.itemCount} links · {formatMinutes(d.stats.minutesSaved)} saved · {d.stats.topics} topics · created {timeAgo(d.createdAt)}
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    {d.shared && (
                      <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">
                        <Globe className="h-3 w-3" /> Shared
                      </span>
                    )}
                    {d.emailedAt && (
                      <span className="chip border-sky-200 bg-sky-50 text-sky-700">
                        <Mail className="h-3 w-3" /> Emailed
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
