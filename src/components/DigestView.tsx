import { Clock3, ExternalLink, Hourglass, Layers, Star } from "lucide-react";
import { type DigestContent, type DigestItem, formatMinutes, formatPeriod } from "@/lib/digest";

export function DigestView({
  digest,
  byline,
}: {
  digest: { title: string; intro: string; periodStart: string; periodEnd: string; content: DigestContent };
  byline?: string;
}) {
  const { stats, picks, sections } = digest.content;
  return (
    <article className="card overflow-hidden">
      <header className="bg-slate-900 px-5 py-7 text-white sm:px-10 sm:py-10">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand-200 uppercase">
          Weekly digest · {formatPeriod(digest.periodStart, digest.periodEnd)}
        </p>
        <h1 className="mt-2 font-serif text-2xl leading-tight font-semibold sm:text-4xl">Your week in reading</h1>
        {byline && <p className="mt-2 text-sm text-slate-300">{byline}</p>}
        <p className="mt-5 max-w-2xl font-serif text-lg leading-relaxed text-slate-200">{digest.intro}</p>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact icon={Layers} label="Links" value={String(stats.items)} />
          <Fact icon={Clock3} label="Full reading" value={formatMinutes(stats.readingMinutes)} />
          <Fact icon={Hourglass} label="This digest" value={formatMinutes(stats.digestMinutes)} />
          <Fact icon={Star} label="Time saved" value={formatMinutes(stats.minutesSaved)} />
        </dl>
      </header>

      <div className="px-5 py-6 sm:px-10 sm:py-8">
        {picks.length > 0 && (
          <section className="mb-10 rounded-2xl border border-brand-100 bg-brand-50/60 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold tracking-wide text-brand-700 uppercase">
              <Star className="h-4 w-4 fill-current" /> Worth a full read
            </h2>
            <ol className="mt-4 space-y-5">
              {picks.map((p, i) => (
                <li key={p.id} className="flex gap-4">
                  <span className="font-serif text-3xl leading-none font-semibold text-brand-300">{i + 1}</span>
                  <Item item={p} compact />
                </li>
              ))}
            </ol>
          </section>
        )}

        {sections.map((s) => (
          <section key={s.topic} className="mb-10 last:mb-0">
            <h2 className="flex items-baseline gap-2 border-b border-slate-200 pb-2 font-serif text-xl font-semibold">
              {s.topic} <span className="font-sans text-sm font-normal text-slate-400">{s.items.length}</span>
            </h2>
            <div className="divide-y divide-slate-100">
              {s.items.map((it) => (
                <div key={it.id} className="py-5">
                  <Item item={it} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
        <Icon className="h-3.5 w-3.5" /> {label}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function Item({ item, compact }: { item: DigestItem; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="group inline-flex items-start gap-1.5 text-base leading-snug font-semibold text-slate-900 hover:text-brand-700 sm:text-lg"
      >
        <span className="break-words">{item.title}</span>
        <ExternalLink className="mt-1.5 h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-brand-600" />
      </a>
      <p className="mt-0.5 text-xs text-slate-500">
        {item.siteName} · {item.readingMinutes} min read
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{item.summary}</p>
      {!compact && item.keyPoints.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
          {item.keyPoints.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
