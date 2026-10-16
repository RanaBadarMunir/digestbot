"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, timeAgo } from "@/lib/client";
import { DailyBars, RankedBars, StackedShare } from "./Charts";

interface Metrics {
  totals: { users: number; activeUsers7d: number; suspended: number; bookmarks: number; digests: number; sharedDigests: number };
  summarySources: Array<{ source: string; count: number }>;
  topics: Array<{ topic: string; count: number }>;
  daily: Array<{ date: string; bookmarks: number; signups: number; digests: number }>;
}
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  createdAt: string;
  lastLoginAt: string | null;
  bookmarks: number;
  digests: number;
}
interface EventRow {
  id: number;
  type: string;
  meta: Record<string, unknown>;
  createdAt: string;
  userEmail: string | null;
}

type Tab = "overview" | "users" | "events";

export function AdminView({ selfId }: { selfId: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Admin</h1>
          <p className="mt-1 text-sm text-slate-500">Platform health, governance and usage analytics.</p>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1" role="tablist">
          {(["overview", "users", "events"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users selfId={selfId} />}
      {tab === "events" && <Events />}
    </div>
  );
}

function Overview() {
  const [m, setM] = useState<Metrics | null>(null);
  useEffect(() => {
    api<Metrics>("/api/admin/metrics")
      .then(setM)
      .catch((e) => toast.error(e.message));
  }, []);
  if (!m) return <div className="card h-64 animate-pulse bg-slate-100/60" />;
  const order = ["ai", "extractive", "pending", "failed"];
  const sources = order.map((s) => ({ label: s === "ai" ? "AI (Gemini)" : s, value: m.summarySources.find((x) => x.source === s)?.count ?? 0 }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          ["Users", m.totals.users],
          ["Active (7 days)", m.totals.activeUsers7d],
          ["Suspended", m.totals.suspended],
          ["Bookmarks", m.totals.bookmarks],
          ["Digests", m.totals.digests],
          ["Shared digests", m.totals.sharedDigests],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{Number(value).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <DailyBars title="Bookmarks saved per day" data={m.daily.map((d) => ({ date: d.date, value: d.bookmarks }))} />
        <DailyBars title="Sign-ups per day" data={m.daily.map((d) => ({ date: d.date, value: d.signups }))} />
        <DailyBars title="Digests generated per day" data={m.daily.map((d) => ({ date: d.date, value: d.digests }))} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <StackedShare title="How bookmarks were summarised" data={sources} />
        <RankedBars title="Top topics across all users" data={m.topics.map((t) => ({ label: t.topic, value: t.count }))} />
      </div>
    </div>
  );
}

function Users({ selfId }: { selfId: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AdminUser[]; total: number } | null>(null);

  const load = useCallback(() => {
    api<{ items: AdminUser[]; total: number }>(`/api/admin/users?${new URLSearchParams({ q, page: String(page) })}`)
      .then(setData)
      .catch((e) => toast.error(e.message));
  }, [q, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function update(id: string, body: Partial<Pick<AdminUser, "role" | "status">>) {
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", json: body });
      toast.success(body.status ? (body.status === "suspended" ? "User suspended" : "User reactivated") : `Role set to ${body.role}`);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search name or email"
          className="input pl-10"
          aria-label="Search users"
        />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Bookmarks</th>
              <th className="px-4 py-3 text-right font-semibold">Digests</th>
              <th className="px-4 py-3 font-semibold">Last login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={u.id === selfId}
                    onChange={(e) => update(u.id, { role: e.target.value as AdminUser["role"] })}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                    aria-label={`Role for ${u.email}`}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`chip ${u.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                    {u.status === "active" ? "● Active" : "■ Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{u.bookmarks}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.digests}</td>
                <td className="px-4 py-3 text-slate-500">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "never"}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== selfId && (
                    <button
                      className={`btn btn-sm ${u.status === "active" ? "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50" : "btn-secondary"}`}
                      onClick={() => update(u.id, { status: u.status === "active" ? "suspended" : "active" })}
                    >
                      {u.status === "active" ? "Suspend" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No users found.</p>}
      </div>
      {data && data.total > 25 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {Math.ceil(data.total / 25)}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page * 25 >= data.total} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function Events() {
  const [type, setType] = useState("");
  const [data, setData] = useState<{ items: EventRow[]; total: number } | null>(null);
  useEffect(() => {
    api<{ items: EventRow[]; total: number }>(`/api/admin/events?${new URLSearchParams({ type })}`)
      .then(setData)
      .catch((e) => toast.error(e.message));
  }, [type]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["", "auth.", "bookmark.", "digest.", "admin.", "cron."].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`chip ${type === t ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}
          >
            {t ? t.replace(".", "") : "all"}
          </button>
        ))}
      </div>
      <div className="card divide-y divide-slate-100">
        {data?.items.map((e) => (
          <div key={e.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
            <code className="w-48 shrink-0 text-xs font-semibold text-slate-800">{e.type}</code>
            <span className="truncate text-slate-600">{e.userEmail ?? "system"}</span>
            <span className="truncate text-xs text-slate-400">{Object.keys(e.meta).length ? JSON.stringify(e.meta) : ""}</span>
            <span className="text-xs whitespace-nowrap text-slate-500 sm:ml-auto">{timeAgo(e.createdAt)}</span>
          </div>
        ))}
        {data && data.items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No events.</p>}
      </div>
    </div>
  );
}
