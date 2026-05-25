"use client";

import type { SnapshotRow } from "./constants";

// Bracket history sparkline rendered as an inline SVG. Drawn manually
// rather than via Recharts because it's a single tiny series — pulling
// in the chart lib for a 5-data-point line would be overkill, and the
// SVG primitives compose with the design tokens naturally.

export function SnapshotHistory({ snapshots }: { snapshots: SnapshotRow[] }) {
  if (snapshots.length < 2) {
    return (
      <section className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          History
        </h3>
        <p className="rounded-md border border-dashed border-border-subtle px-3 py-4 text-center text-xs text-text-muted">
          Bracket history accumulates with snapshots.
          {snapshots.length === 1 && " 1 snapshot so far."}
        </p>
      </section>
    );
  }

  const ordered = [...snapshots].reverse();
  const points = ordered
    .filter((s) => s.calculatedBracket != null)
    .map((s) => ({
      bracket: s.calculatedBracket as number,
      at: new Date(s.snapshotAt).getTime(),
    }));
  if (points.length < 2) {
    return null;
  }
  const first = points[0].at;
  const last = points[points.length - 1].at;
  const span = Math.max(1, last - first);
  const max = 5;
  const min = 1;

  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
        History · {points.length} snapshots
      </h3>
      <div className="rounded-md border border-border-subtle bg-surface-raised p-3">
        <svg viewBox="0 0 400 90" className="h-24 w-full">
          {/* Horizontal gridlines for B1..B5 */}
          {[1, 2, 3, 4, 5].map((b) => {
            const y = 78 - ((b - min) / (max - min)) * 64;
            return (
              <g key={b}>
                <line
                  x1="24"
                  y1={y}
                  x2="396"
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.06"
                  strokeDasharray="2 3"
                />
                <text
                  x="0"
                  y={y + 3}
                  fontFamily="var(--font-mono)"
                  fontSize="8"
                  fill={`var(--color-bracket-${b})`}
                  opacity="0.7"
                >
                  B{b}
                </text>
              </g>
            );
          })}
          {points.map((p, i) => {
            const x = ((p.at - first) / span) * 360 + 32;
            const y = 78 - ((p.bracket - min) / (max - min)) * 64;
            const prev = i > 0 ? points[i - 1] : null;
            return (
              <g key={i}>
                {prev && (
                  <line
                    x1={((prev.at - first) / span) * 360 + 32}
                    y1={78 - ((prev.bracket - min) / (max - min)) * 64}
                    x2={x}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.35"
                    strokeWidth="1.25"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r="3"
                  fill={`var(--color-bracket-${p.bracket})`}
                  opacity="0.9"
                />
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wide text-text-muted">
          <span>{new Date(first).toLocaleDateString()}</span>
          <span>{new Date(last).toLocaleDateString()}</span>
        </div>
      </div>
    </section>
  );
}
