"use client";

import { useState } from "react";

/** Categorical slots (fixed order, validated palette) and chart chrome. */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const GRID = "#e1e0d9";
const BASELINE = "#c3c2b7";
const MUTED = "#898781";

/** Single-series column chart over days, with hover tooltip and table fallback. */
export function DailyBars({ title, data, color = SERIES[0] }: { title: string; data: Array<{ date: string; value: number }>; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const H = 130;
  const pad = { l: 28, r: 6, t: 10, b: 22 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const total = data.reduce((s, d) => s + d.value, 0);
  const h = hover !== null ? data[hover] : null;

  return (
    <figure className="card p-4">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <span className="text-xs text-slate-500">{h ? `${h.date}: ${h.value}` : `${total} in 30 days`}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`${title}, ${total} over the last 30 days`} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke={f === 0 ? BASELINE : GRID} strokeWidth={1} />
            <text x={pad.l - 6} y={y(niceMax * f) + 3} textAnchor="end" fontSize="10" fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
              {niceMax * f}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw;
          const top = y(d.value);
          const height = y(0) - top;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {d.value > 0 && (
                <path
                  d={`M${x + 1},${y(0)} V${top + Math.min(4, height)} q0,-${Math.min(4, height)} ${Math.min(4, height)},-${Math.min(4, height)} H${x + bw - 1 - Math.min(4, height)} q${Math.min(4, height)},0 ${Math.min(4, height)},${Math.min(4, height)} V${y(0)} Z`}
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          );
        })}
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) =>
          data[i] ? (
            <text key={i} x={pad.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill={MUTED}>
              {data[i].date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <details className="mt-1 text-xs text-slate-500">
        <summary className="cursor-pointer">Table view</summary>
        <div className="mt-2 max-h-40 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-slate-100">
                  <td className="py-0.5">{d.date}</td>
                  <td className="py-0.5 text-right">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Part-to-whole as one stacked bar with legend + direct labels. */
export function StackedShare({ title, data }: { title: string; data: Array<{ label: string; value: number }> }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure className="card p-4">
      <figcaption className="text-sm font-semibold text-slate-800">{title}</figcaption>
      {total === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No data yet.</p>
      ) : (
        <>
          <div className="mt-4 flex h-4 gap-[2px] overflow-hidden rounded" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join(", ")}>
            {data.map((d, i) =>
              d.value ? (
                <div
                  key={d.label}
                  title={`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}
                  style={{ width: `${(d.value / total) * 100}%`, background: SERIES[i] }}
                  className="first:rounded-l last:rounded-r"
                />
              ) : null,
            )}
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {data.map((d, i) => (
              <li key={d.label} className="flex items-center gap-2 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} aria-hidden />
                <span className="capitalize">{d.label}</span>
                <span className="ml-auto text-slate-500 tabular-nums">
                  {d.value} · {Math.round((d.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </figure>
  );
}

/** Ranked magnitudes: horizontal bars, single hue, values in text ink. */
export function RankedBars({ title, data }: { title: string; data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="card p-4">
      <figcaption className="text-sm font-semibold text-slate-800">{title}</figcaption>
      {data.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.map((d) => (
            <li key={d.label} className="text-sm" title={`${d.label}: ${d.value}`}>
              <div className="flex justify-between text-slate-700">
                <span className="truncate">{d.label}</span>
                <span className="text-slate-500 tabular-nums">{d.value}</span>
              </div>
              <div className="mt-1 h-2 rounded-r" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: SERIES[0] }} />
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
