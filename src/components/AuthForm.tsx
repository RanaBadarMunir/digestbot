"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, ClientError } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFields({});
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: Object.fromEntries(form) });
      toast.success(mode === "signup" ? "Welcome to DigestBot!" : "Welcome back!");
      router.replace(safeNext);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientError) {
        setFields(err.fields ?? {});
        setError(err.message);
      } else setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
      {mode === "signup" && (
        <div>
          <label htmlFor="name" className="label">
            Name
          </label>
          <input id="name" name="name" className="input" autoComplete="name" required maxLength={80} />
          {fields.name && <p className="mt-1 text-xs text-rose-600">{fields.name}</p>}
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
        {fields.email && <p className="mt-1 text-xs text-rose-600">{fields.email}</p>}
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 8 : 1}
        />
        {mode === "signup" && !fields.password && <p className="mt-1 text-xs text-slate-500">At least 8 characters, with a letter and a number.</p>}
        {fields.password && <p className="mt-1 text-xs text-rose-600">{fields.password}</p>}
      </div>
      <button className="btn btn-primary w-full py-3" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "signup" ? "Create account" : "Log in"}
      </button>
      <p className="text-center text-sm text-slate-600">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-600 hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-600 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
