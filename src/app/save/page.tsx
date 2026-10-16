"use client";

import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { api } from "@/lib/client";

function SaveInner() {
  const params = useSearchParams();
  const url = params.get("url") ?? params.get("text") ?? "";
  const title = params.get("title") ?? undefined;
  const [state, setState] = useState<"saving" | "saved" | "duplicate" | "error">("saving");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const link = url.match(/https?:\/\/\S+/)?.[0] ?? url;
    if (!link) {
      setState("error");
      setMessage("No link was provided.");
      return;
    }
    api<{ duplicate: boolean }>("/api/bookmarks", { method: "POST", json: { url: link, title } })
      .then((r) => {
        setState(r.duplicate ? "duplicate" : "saved");
        if (window.opener) setTimeout(() => window.close(), 1800);
      })
      .catch((e) => {
        setState("error");
        setMessage(e.message);
      });
  }, [url, title]);

  return (
    <div className="card w-full max-w-sm p-6 text-center">
      <LogoMark className="mx-auto h-10 w-10" />
      {state === "saving" && (
        <p className="mt-4 flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" /> Saving…
        </p>
      )}
      {(state === "saved" || state === "duplicate") && (
        <>
          <CheckCircle2 className="mx-auto mt-4 h-8 w-8 text-emerald-500" />
          <p className="mt-2 font-semibold">{state === "saved" ? "Saved to DigestBot" : "Already in your library"}</p>
          <p className="mt-1 line-clamp-2 text-sm break-all text-slate-500">{title || url}</p>
        </>
      )}
      {state === "error" && (
        <>
          <TriangleAlert className="mx-auto mt-4 h-8 w-8 text-amber-500" />
          <p className="mt-2 font-semibold">Couldn’t save</p>
          <p className="mt-1 text-sm text-slate-500">{message}</p>
        </>
      )}
      <Link href="/app" className="btn btn-secondary btn-sm mt-5">
        Open library
      </Link>
    </div>
  );
}

export default function SavePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <SaveInner />
      </Suspense>
    </div>
  );
}
