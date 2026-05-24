"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailySnapshot } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

const RANGES = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
  { label: "All", days: null },
] as const;

export function ValueChart({ snapshots }: { snapshots: DailySnapshot[] }) {
  const [rangeIdx, setRangeIdx] = useState(0);
  const range = RANGES[rangeIdx];
  const [nowMs] = useState(() => Date.now());

  const data = useMemo(() => {
    if (range.days == null) return snapshots;
    const cutoffMs = nowMs - range.days * 86_400_000;
    return snapshots.filter(
      (s) => new Date(s.date).getTime() >= cutoffMs,
    );
  }, [snapshots, range.days, nowMs]);

  if (snapshots.length < 2) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-md border border-dashed border-border-subtle p-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Accumulating
        </p>
        <p className="mt-1 max-w-[42ch] text-xs text-text-secondary">
          The daily snapshot runs after the Scryfall price refresh.
          Trends appear once a few days of data have accumulated.
        </p>
        {snapshots.length === 1 && (
          <p className="num mt-2 text-[13px] text-text-primary">
            Today: ${snapshots[0].marketValueUsd.toFixed(2)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {data.length} points
        </p>
        <div className="inline-flex overflow-hidden rounded-sm border border-border-subtle">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeIdx(i)}
              className={cn(
                "border-l border-border-subtle px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors first:border-l-0",
                i === rangeIdx
                  ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
                  : "bg-surface-raised text-text-muted hover:text-text-primary",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="valueChartFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-value-positive)"
                  stopOpacity={0.32}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-value-positive)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--color-border-subtle)"
              strokeOpacity={0.6}
              strokeDasharray="2 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                fill: "var(--color-text-muted)",
              }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border-subtle)" }}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(v: number) =>
                `$${Math.round(v).toLocaleString()}`
              }
              tick={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                fill: "var(--color-text-muted)",
              }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              cursor={{
                stroke: "var(--color-border-strong)",
                strokeWidth: 1,
              }}
              contentStyle={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                backgroundColor: "var(--color-surface-overlay)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: 4,
                color: "var(--color-text-primary)",
              }}
              itemStyle={{
                color: "var(--color-text-primary)",
                padding: 0,
              }}
              labelStyle={{
                color: "var(--color-text-muted)",
                fontSize: 10,
                marginBottom: 2,
              }}
              formatter={(value) =>
                typeof value === "number"
                  ? `$${value.toFixed(2)}`
                  : String(value)
              }
            />
            <Area
              type="monotone"
              dataKey="marketValueUsd"
              name="Market"
              stroke="var(--color-value-positive)"
              strokeWidth={2}
              fill="url(#valueChartFill)"
            />
            <Line
              type="monotone"
              dataKey="costBasisUsd"
              name="Cost basis"
              stroke="var(--color-text-muted)"
              strokeDasharray="3 3"
              strokeWidth={1.25}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
