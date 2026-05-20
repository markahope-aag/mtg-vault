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
      <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          Collection value tracking is just getting started.
        </p>
        <p className="mt-1 text-xs">
          The daily snapshot runs after the Scryfall price refresh. Trends
          appear once a few days of data have accumulated.
          {snapshots.length === 1 && (
            <> Today&rsquo;s value: ${snapshots[0].marketValueUsd.toFixed(2)}.</>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 text-xs">
        {RANGES.map((r, i) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setRangeIdx(i)}
            className={`rounded-md px-2 py-1 ${i === rangeIdx ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="marketFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeOpacity={0.1} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20} />
            <YAxis
              tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
              tick={{ fontSize: 11 }}
              width={70}
            />
            <Tooltip
              formatter={(value) =>
                typeof value === "number" ? `$${value.toFixed(2)}` : String(value)
              }
              labelClassName="text-xs"
              wrapperClassName="text-xs"
            />
            <Area
              type="monotone"
              dataKey="marketValueUsd"
              name="Market value"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#marketFill)"
            />
            <Line
              type="monotone"
              dataKey="costBasisUsd"
              name="Cost basis"
              stroke="#71717a"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
