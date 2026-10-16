"use client";

import { Inbox, Library, LogOut, Settings, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Logo } from "./Logo";

const NAV = [
  { href: "/app", label: "Library", icon: Library, exact: true },
  { href: "/app/digests", label: "Digests", icon: Inbox },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ user, children }: { user: { name: string; email: string; role: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = user.role === "admin" ? [...NAV, { href: "/admin", label: "Admin", icon: Shield }] : NAV;
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    toast.success("Logged out");
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo href="/app" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active(n.href, n.exact) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium text-slate-800">{user.name}</p>
              <p className="text-xs leading-tight text-slate-500">{user.email}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700" aria-hidden>
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <button onClick={logout} className="btn btn-ghost btn-sm" aria-label="Log out" title="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden" aria-label="Main mobile">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              active(n.href, n.exact) ? "text-brand-600" : "text-slate-500"
            }`}
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
