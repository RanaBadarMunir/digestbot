import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DigestActions } from "@/components/DigestActions";
import { DigestView } from "@/components/DigestView";
import { currentUser } from "@/server/auth";
import { getDigest, serializeDigest } from "@/server/digests";
import { emailEnabled } from "@/server/email";
import { appUrl } from "@/server/http";

export const metadata: Metadata = { title: "Digest" };

export default async function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const d = await getDigest(user, id).catch(() => null);
  if (!d) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const digest = serializeDigest(d, process.env.APP_URL || (host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : appUrl()));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/digests" className="btn btn-ghost btn-sm -ml-2">
          <ArrowLeft className="h-4 w-4" /> All digests
        </Link>
        <DigestActions id={digest.id} shared={digest.shared} shareUrl={digest.shareUrl} emailEnabled={emailEnabled()} />
      </div>
      <DigestView digest={digest} />
    </div>
  );
}
