"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Bargain = {
  oracleId: string;
  name: string;
  baselineUsd: number;
  listing: {
    sourceId: string;
    rawTitle: string;
    priceUsd: number;
    shippingUsd: number | null;
    url: string;
    confidence: number;
    condition: string | null;
    foil: boolean | null;
    flags: string[];
  };
  savingsUsd: number;
  savingsPct: number;
};

type SweepResult = {
  bargains: Bargain[];
  unmetWants: Array<{ oracleId: string; name: string; targetQuantity: number }>;
  sourceStats: Array<{
    sourceId: string;
    enabled: boolean;
    listingCount: number;
    errorCount: number;
  }>;
};

export function BargainsPanel({
  hasEnabledSources,
}: {
  hasEnabledSources: boolean;
}) {
  const [result, setResult] = useState<SweepResult | null>(null);
  const [sweeping, setSweeping] = useState(false);

  const runSweep = useCallback(async () => {
    setSweeping(true);
    try {
      const res = await fetch("/api/market/bargains", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body);
      toast.success(`Found ${body.bargains.length} bargain(s).`);
    } catch (err) {
      toast.error(
        `Sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSweeping(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-baseline justify-between text-base">
          <span>Bargains</span>
          <Button
            size="sm"
            variant="outline"
            onClick={runSweep}
            disabled={sweeping || !hasEnabledSources}
          >
            <RefreshCw
              className={cn("size-3", sweeping && "animate-spin")}
            />{" "}
            {sweeping ? "Sweeping…" : "Run sweep"}
          </Button>
        </CardTitle>
        <p className="text-[11px] text-text-muted">
          Active listings priced below trailing baseline (sold-median when a
          source has it, else 90-day price-history median). Cross-references
          your want list (manual + deck-need shortfall).
        </p>
      </CardHeader>
      <CardContent className="p-3">
        {!hasEnabledSources && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <p className="font-medium">No market sources enabled.</p>
            <p className="mt-1 text-text-muted">
              Add an LGS via{" "}
              <Link
                href="/admin/market-sources"
                className="text-[var(--brand)] hover:underline"
              >
                /admin/market-sources
              </Link>{" "}
              or configure the eBay adapter creds in <code>.env.local</code>.
              Bargain sweeps will return empty until at least one source is
              enabled.
            </p>
          </div>
        )}

        {result == null && hasEnabledSources && (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-muted">
            Click <strong>Run sweep</strong> to query enabled sources for your
            want list.
          </p>
        )}

        {result && (
          <>
            {result.bargains.length === 0 && (
              <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-muted">
                No bargains found this sweep. Tweak want-list max prices or
                wait for new listings.
              </p>
            )}
            <ul className="space-y-1.5">
              {result.bargains.map((b, i) => {
                const totalCost =
                  b.listing.priceUsd + (b.listing.shippingUsd ?? 0);
                return (
                  <li
                    key={`${b.oracleId}-${i}`}
                    className="rounded-md border border-border-subtle bg-surface-raised p-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link
                        href={`/cards/${b.oracleId}`}
                        className="font-medium hover:underline"
                      >
                        {b.name}
                      </Link>
                      <a
                        href={b.listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-muted hover:text-text-primary"
                      >
                        {b.listing.sourceId} <ExternalLink className="size-3" />
                      </a>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-text-muted">
                      {b.listing.rawTitle}
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <div className="font-mono tabular-nums">
                        ${totalCost.toFixed(2)}
                        {b.listing.shippingUsd != null &&
                          b.listing.shippingUsd > 0 && (
                            <span className="text-text-muted">
                              {" "}
                              (incl. ${b.listing.shippingUsd.toFixed(2)} ship)
                            </span>
                          )}
                        {" "}vs baseline ${b.baselineUsd.toFixed(2)}
                      </div>
                      <span className="font-mono font-semibold text-[var(--value-positive)]">
                        −${b.savingsUsd.toFixed(2)} ({b.savingsPct.toFixed(0)}
                        %)
                      </span>
                    </div>
                    {b.listing.flags.length > 0 && (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-500">
                        flags: {b.listing.flags.join(", ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {result.sourceStats.length > 0 && (
              <div className="mt-3 border-t border-border-subtle pt-2 font-mono text-[10px] uppercase text-text-muted">
                Sources queried:{" "}
                {result.sourceStats
                  .filter((s) => s.enabled)
                  .map((s) => `${s.sourceId} (${s.listingCount})`)
                  .join(", ") || "none"}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
