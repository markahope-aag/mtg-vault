import { ValueDelta } from "@/components/value-delta";
import { cn } from "@/lib/utils";

type CollectionValue = {
  marketValueUsd: number;
  costBasisUsd: number;
  unrealizedGainUsd: number;
  realizedGainUsd: number;
  realizedProceedsUsd: number;
  totalCards: number;
  uniqueCards: number;
  foilCount: number;
};

type Snapshot = { date: string; marketValueUsd: number };

export function CollectionHero({
  value,
  snapshots,
}: {
  value: CollectionValue;
  snapshots: Snapshot[];
}) {
  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const priorSnapshot = [...snapshots]
    .reverse()
    .find((s) => s.date <= thirtyDaysAgo);
  const valueDelta30d = priorSnapshot
    ? value.marketValueUsd - priorSnapshot.marketValueUsd
    : null;
  const valueDelta30dPct =
    priorSnapshot && priorSnapshot.marketValueUsd > 0
      ? (value.marketValueUsd / priorSnapshot.marketValueUsd - 1) * 100
      : null;

  const unrealizedPct =
    value.costBasisUsd > 0
      ? (value.unrealizedGainUsd / value.costBasisUsd) * 100
      : null;

  const latestSnapshot = snapshots[snapshots.length - 1] ?? null;
  const hasRealized =
    value.realizedGainUsd !== 0 || value.realizedProceedsUsd !== 0;

  return (
    <section className="hero-surface relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-40" aria-hidden />
      <div className="relative grid grid-cols-1 gap-x-10 gap-y-4 px-7 py-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.28em] text-[var(--brand)]">
            Market value
          </p>
          <p className="num text-[56px] font-semibold leading-none text-[var(--text-primary)]">
            <span className="text-[28px] text-[var(--text-muted)]">$</span>
            {value.marketValueUsd.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[12px] uppercase tracking-wide">
            {valueDelta30d != null ? (
              <>
                <ValueDelta value={valueDelta30d} className="text-[14px]" />
                {valueDelta30dPct != null && (
                  <span
                    className={cn(
                      "num text-[12px]",
                      valueDelta30dPct >= 0
                        ? "text-[var(--color-value-positive)]"
                        : "text-[var(--color-value-negative)]",
                    )}
                  >
                    {valueDelta30dPct >= 0 ? "+" : ""}
                    {valueDelta30dPct.toFixed(2)}%
                  </span>
                )}
                <span className="text-[var(--text-muted)]">· vs 30d ago</span>
              </>
            ) : (
              <span className="empty-terminal">30d trend accumulating</span>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-7 gap-y-3 self-end lg:border-l lg:border-[var(--border-subtle)] lg:pl-9">
          <LedgerRow
            label="Cost basis"
            value={`$${formatNum(value.costBasisUsd)}`}
          />
          <LedgerRow
            label="Unrealized"
            value={
              <span
                className={cn(
                  "num",
                  value.unrealizedGainUsd > 0
                    ? "text-[var(--color-value-positive)]"
                    : value.unrealizedGainUsd < 0
                      ? "text-[var(--color-value-negative)]"
                      : "text-text-muted",
                )}
              >
                {value.unrealizedGainUsd >= 0 ? "+" : "−"}$
                {formatNum(Math.abs(value.unrealizedGainUsd))}
                {unrealizedPct != null && (
                  <span className="ml-1 text-[12px] text-[var(--text-muted)]">
                    ({unrealizedPct >= 0 ? "+" : ""}
                    {unrealizedPct.toFixed(1)}%)
                  </span>
                )}
              </span>
            }
          />
          <LedgerRow
            label="Cards"
            value={`${value.totalCards.toLocaleString()} · ${value.uniqueCards.toLocaleString()} uq`}
          />
          <LedgerRow label="Foil" value={value.foilCount.toLocaleString()} />
          {hasRealized && (
            <LedgerRow
              label="Realized"
              value={
                <span
                  className={cn(
                    "num",
                    value.realizedGainUsd >= 0
                      ? "text-[var(--color-value-positive)]"
                      : "text-[var(--color-value-negative)]",
                  )}
                >
                  {value.realizedGainUsd >= 0 ? "+" : "−"}$
                  {formatNum(Math.abs(value.realizedGainUsd))}
                </span>
              }
            />
          )}
          {latestSnapshot && (
            <LedgerRow
              label="Updated"
              value={
                <span className="text-[var(--text-muted)]">
                  {new Date(latestSnapshot.date).toLocaleDateString()}
                </span>
              }
            />
          )}
        </dl>
      </div>
    </section>
  );
}

function formatNum(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function LedgerRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--border-subtle)]/60 pb-2 last:border-b-0 last:pb-0">
      <dt className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="num text-[16px] font-medium text-[var(--text-primary)]">
        {value}
      </dd>
    </div>
  );
}
