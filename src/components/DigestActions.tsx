"use client";

import { Copy, Globe, Loader2, Lock, Mail, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";

export function DigestActions(props: { id: string; shared: boolean; shareUrl: string | null; emailEnabled: boolean }) {
  const router = useRouter();
  const [shared, setShared] = useState(props.shared);
  const [shareUrl, setShareUrl] = useState(props.shareUrl);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleShare() {
    setBusy("share");
    try {
      const { digest } = await api<{ digest: { shared: boolean; shareUrl: string | null } }>(`/api/digests/${props.id}`, {
        method: "PATCH",
        json: { shared: !shared },
      });
      setShared(digest.shared);
      setShareUrl(digest.shareUrl);
      if (digest.shareUrl) {
        await navigator.clipboard?.writeText(digest.shareUrl).catch(() => {});
        toast.success("Public link created and copied");
      } else toast.success("Link disabled — the digest is private again");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function email() {
    setBusy("email");
    try {
      await api(`/api/digests/${props.id}/email`, { method: "POST" });
      toast.success("Sent to your inbox");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this digest? Your bookmarks stay in your library.")) return;
    setBusy("delete");
    try {
      await api(`/api/digests/${props.id}`, { method: "DELETE" });
      toast.success("Digest deleted");
      router.replace("/app/digests");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {shared && shareUrl && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copied"))}
          title={shareUrl}
        >
          <Copy className="h-3.5 w-3.5" /> Copy link
        </button>
      )}
      <button className={`btn btn-sm ${shared ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "btn-secondary"}`} onClick={toggleShare} disabled={busy !== null}>
        {busy === "share" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : shared ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        {shared ? "Public · stop sharing" : "Share publicly"}
      </button>
      <button
        className="btn btn-secondary btn-sm"
        onClick={email}
        disabled={busy !== null || !props.emailEnabled}
        title={props.emailEnabled ? "Email this digest to yourself" : "Email delivery isn't configured on this server"}
      >
        {busy === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Email me
      </button>
      <button className="btn btn-sm border border-rose-200 bg-white text-rose-600 hover:bg-rose-50" onClick={remove} disabled={busy !== null}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
    </div>
  );
}
