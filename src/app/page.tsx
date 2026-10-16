import { ArrowRight, BookmarkPlus, Clock3, Inbox, Share2, Sparkles, Tags } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { currentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

const steps = [
  { icon: BookmarkPlus, title: "Save in one click", body: "Paste a link, use the bookmarklet, or import your whole browser bookmarks file." },
  { icon: Sparkles, title: "AI reads it for you", body: "Each link is fetched, summarised into a TL;DR and three key points, tagged and prioritised." },
  { icon: Inbox, title: "One weekly digest", body: "On your chosen day, everything you saved arrives as a five-minute newsletter." },
];

const features = [
  { icon: Tags, title: "Smart triage", body: "Topics, tags, priority and reading time — so you know which 3 of 50 links deserve your evening." },
  { icon: Clock3, title: "Hours back every week", body: "Read the gist of everything; open only what's worth a full read." },
  { icon: Share2, title: "Share with your team", body: "Publish any digest as a read-only link — the reading list your team actually reads." },
];

export default async function Landing() {
  const user = await currentUser().catch(() => null);
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#e0e7ff_0%,#f7f7fb_55%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href="/app" className="btn btn-primary">
              Open app <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="chip border-brand-200 bg-white text-brand-700">
              <Sparkles className="h-3.5 w-3.5" /> For people with 50+ “read later” links
            </p>
            <h1 className="mt-5 font-serif text-4xl leading-[1.08] font-semibold tracking-tight text-slate-900 sm:text-6xl">
              Your bookmarks,
              <br />
              <span className="text-brand-600">read for you.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Save articles, tweets and technical blogs without guilt. DigestBot summarises every link with AI and sends you one
              five-minute digest each week.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/app" : "/signup"} className="btn btn-primary px-6 py-3 text-base">
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="btn btn-secondary px-6 py-3 text-base">
                See how it works
              </a>
            </div>
          </div>

          <div className="card relative overflow-hidden p-0" aria-label="Sample digest">
            <div className="bg-slate-900 px-6 py-5 text-white">
              <p className="text-xs font-semibold tracking-[0.18em] text-brand-200 uppercase">Weekly digest</p>
              <p className="mt-1 font-serif text-2xl">12–18 Oct · 14 links</p>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm leading-relaxed text-slate-600">
                This week you saved 14 links — mostly about AI agents and Postgres performance. Reading them all would take 2 h 10 min;
                this digest takes 6.
              </p>
              {[
                ["AI & Machine Learning", "Building reliable agents with tool calling", "3 patterns that cut failure rates in half…"],
                ["Data & Databases", "Postgres 17: what actually got faster", "Incremental backups and a 2× faster VACUUM…"],
                ["Career & Productivity", "Async standups that people read", "Write updates as decisions, not diaries…"],
              ].map(([topic, title, tldr]) => (
                <div key={title} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold tracking-wide text-brand-600 uppercase">{topic}</p>
                  <p className="mt-1 font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm text-slate-500">{tldr}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="py-12">
          <h2 className="text-center font-serif text-3xl font-semibold">How it works</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-slate-400">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 py-12 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="p-2">
              <f.icon className="h-6 w-6 text-brand-600" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="my-12 rounded-3xl bg-slate-900 px-6 py-12 text-center text-white sm:px-12">
          <h2 className="font-serif text-3xl font-semibold">Stop hoarding. Start knowing.</h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-300">Free to use. Your first digest is one click away.</p>
          <Link href={user ? "/app" : "/signup"} className="btn mt-6 bg-white px-6 py-3 text-base text-slate-900 hover:bg-brand-50">
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        DigestBot · PTUT-PRJ-096 · Productivity, Remote Work & Asynchronous Collaboration
      </footer>
    </div>
  );
}
