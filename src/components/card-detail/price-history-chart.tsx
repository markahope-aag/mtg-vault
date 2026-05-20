"use client";

import { useEffect, useState } from "react";
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

  if (loading || points === null) {
    return (
      <div className="h-32 animate-pulse rounded bg-muted/50" />
    );
  }

  if (points.length < 2) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        Price history accumulates daily. Check back soon.
      </p>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <LineChart data={points}>
          <CartesianGrid strokeOpacity={0.1} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
          <YAxis
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tick={{ fontSize: 10 }}
            width={50}
          />
          <Tooltip
            formatter={(value) =>
              typeof value === "number" ? `$${value.toFixed(2)}` : String(value)
            }
            labelClassName="text-xs"
            wrapperClassName="text-xs"
          />
          <Line
            type="monotone"
            dataKey="usd"
            name="USD"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="usdFoil"
            name="Foil"
            stroke="#a855f7"
            strokeWidth={2}
            strokeDasharray="3 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
