import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DigestView } from "@/components/DigestView";
import { LogoMark } from "@/components/Logo";
import { getSharedDigest } from "@/server/digests";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const row = await getSharedDigest((await params).token);
  if (!row) return { title: "Digest not found" };
  return {
    title: `${row.ownerName}'s reading digest`,
    description: row.digest.intro.slice(0, 160),
    robots: { index: false, follow: false },
  };
}

export default async function SharedDigestPage({ params }: { params: Promise<{ token: string }> }) {
  const row = await getSharedDigest((await params).token);
  if (!row) notFound();
  return (
    <div className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <DigestView digest={row.digest} byline={`Curated by ${row.ownerName}`} />
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
          <LogoMark className="h-5 w-5" /> Made with{" "}
          <Link href="/" className="font-semibold text-brand-600 hover:underline">
            DigestBot
          </Link>{" "}
          — turn your bookmarks into a weekly digest.
        </p>
      </div>
    </div>
  );
}
