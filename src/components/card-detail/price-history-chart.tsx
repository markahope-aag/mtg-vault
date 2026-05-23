"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; usd: number | null; usdFoil: number | null };

function fmt(v: number, max: number): string {
  // Adaptive precision so cheap cards don't show "$0" on every tick.
  if (max < 1) return `$${v.toFixed(2)}`;
  if (max < 10) return `$${v.toFixed(2)}`;
  if (max < 100) return `$${v.toFixed(1)}`;
  return `$${v.toFixed(0)}`;
}

export function PriceHistoryChart({
  oracleId,
  printingId,
}: {
  oracleId: string;
  printingId?: string;
}) {
  const [points, setPoints] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("days", "90");
    if (printingId) params.set("printingId", printingId);
    fetch(`/api/cards/${oracleId}/price-history?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setPoints(d?.points ?? []);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [oracleId, printingId]);

  const stats = useMemo(() => {
    if (!points || points.length === 0) {
      return { hasUsd: false, hasFoil: false, max: 0, latestUsd: null as number | null, latestFoil: null as number | null };
    }
    let max = 0;
    let hasUsd = false;
    let hasFoil = false;
    let latestUsd: number | null = null;
    let latestFoil: number | null = null;
    for (const p of points) {
      if (p.usd != null && Number.isFinite(p.usd)) {
        hasUsd = true;
        if (p.usd > max) max = p.usd;
        latestUsd = p.usd;
      }
      if (p.usdFoil != null && Number.isFinite(p.usdFoil)) {
        hasFoil = true;
        if (p.usdFoil > max) max = p.usdFoil;
        latestFoil = p.usdFoil;
      }
    }
    return { hasUsd, hasFoil, max, latestUsd, latestFoil };
  }, [points]);

  if (loading || points === null) {
    return <div className="h-32 animate-pulse rounded bg-muted/50" />;
  }

  if (points.length < 2) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        Price history accumulates daily. Check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
        {stats.hasUsd && stats.latestUsd != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-500" />
            <span className="text-muted-foreground">Normal</span>
            <span className="tabular-nums font-medium">
              ${stats.latestUsd.toFixed(2)}
            </span>
          </span>
        )}
        {stats.hasFoil && stats.latestFoil != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-purple-500" />
            <span className="text-muted-foreground">Foil</span>
            <span className="tabular-nums font-medium">
              ${stats.latestFoil.toFixed(2)}
            </span>
          </span>
        )}
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeOpacity={0.1} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
            <YAxis
              tickFormatter={(v: number) => fmt(v, stats.max)}
              tick={{ fontSize: 10 }}
              width={56}
              domain={[0, "auto"]}
              allowDecimals={stats.max < 10}
            />
            <Tooltip
              formatter={(value) =>
                typeof value === "number" ? `$${value.toFixed(2)}` : String(value)
              }
              labelClassName="text-xs"
              wrapperClassName="text-xs"
            />
            {stats.hasUsd && (
              <Line
                type="monotone"
                dataKey="usd"
                name="Normal"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {stats.hasFoil && (
              <Line
                type="monotone"
                dataKey="usdFoil"
                name="Foil"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
