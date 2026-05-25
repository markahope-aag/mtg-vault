import Link from "next/link";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MarketMover } from "@/lib/decks/command-data";

function formatDelta(pct: number | null): {
  text: string;
  className: string;
} {
  if (pct == null) return { text: "—", className: "text-text-muted" };
  const sign = pct >= 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    className:
      pct > 0
        ? "text-[var(--value-positive)]"
        : pct < 0
          ? "text-[var(--value-negative)]"
          : "text-text-muted",
  };
}

export function MarketMoversPanel({ movers }: { movers: MarketMover[] }) {
  // Net 30d move across the visible movers — gives the headline number
  // the spec calls out ("deck moved +$X this week" — adapted to 30d so
  // it's less noisy day-to-day).
  const net30d = movers.reduce((acc, m) => {
    if (m.delta30dPct == null) return acc;
    const prior = m.currentUsd / (1 + m.delta30dPct / 100);
    return acc + (m.currentUsd - prior);
  }, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Market movers
        </CardTitle>
        <span
          className={cn(
            "font-mono text-[11px]",
            net30d > 0
              ? "text-[var(--value-positive)]"
              : net30d < 0
                ? "text-[var(--value-negative)]"
                : "text-text-muted",
          )}
        >
          30d {net30d >= 0 ? "+" : ""}${net30d.toFixed(2)}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        {movers.length === 0 ? (
          <p className="empty-terminal px-4 py-6 text-center">
            no expensive cards in this deck yet
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {movers.map((m) => {
              const d7 = formatDelta(m.delta7dPct);
              const d30 = formatDelta(m.delta30dPct);
              return (
                <li
                  key={m.printingId}
                  className="flex items-center gap-3 px-3 py-1.5"
                >
                  <ImgWithFallback
                    src={m.imageUri}
                    alt={m.name}
                    className="size-8 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                    fallbackClassName="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-inset text-text-muted ring-1 ring-border-subtle"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/cards/${m.oracleId}`}
                      className="block truncate text-[12px] font-medium hover:underline"
                    >
                      {m.name}
                    </Link>
                    <p className="font-mono text-[10px] uppercase text-text-muted">
                      {m.setCode} · ${m.currentUsd.toFixed(2)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px]">
                    <p className={d7.className}>{d7.text}<span className="text-text-muted"> 7d</span></p>
                    <p className={d30.className}>{d30.text}<span className="text-text-muted"> 30d</span></p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
