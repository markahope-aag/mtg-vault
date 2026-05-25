import Link from "next/link";
import { notFound } from "next/navigation";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { ManaCost } from "@/components/mana-cost";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { loadCommandData } from "@/lib/decks/command-data";
import { BracketPanel } from "@/components/deck-command/bracket-panel";
import {
  CompletionPanel,
  ContentionPanel,
} from "@/components/deck-command/completion-contention-panels";
import { GameplanPanel } from "@/components/deck-command/gameplan-panel";
import { MarketMoversPanel } from "@/components/deck-command/market-movers-panel";
import { PerformancePanel } from "@/components/deck-command/performance-panel";
import { pickCardImage } from "@/lib/card-image";

export const dynamic = "force-dynamic";

export default async function DeckCommandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadCommandData(id);
  if (!data) notFound();
  const { detail, bracket, reconcile, analysis, marketMovers, gameStats } =
    data;

  const cmd = detail.commander;
  const cmdImage = cmd
    ? pickCardImage(
        cmd.printing.imageUris as
          | Record<string, string>
          | null
          | undefined,
        cmd.printing.cardFaces as
          | Array<{ image_uris?: Record<string, string> | null }>
          | null
          | undefined,
        "small",
      )
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/decks" label="Decks" />
      </div>

      {/* Top band: deck identity + headline numbers */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div className="flex items-center gap-4">
          {cmdImage && (
            <ImgWithFallback
              src={cmdImage}
              alt={cmd?.name ?? ""}
              className="size-14 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
              fallbackClassName="flex size-14 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
            />
          )}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
              Command center
            </p>
            <h1 className="font-[var(--font-display)] text-[28px] font-semibold leading-[1.1] tracking-tight">
              {detail.deck.name}
            </h1>
            <p className="mt-0.5 text-[13px] text-text-muted">
              {cmd?.name ?? "no commander set"}
              {detail.partner && ` · ${detail.partner.name}`}
              {detail.colorIdentity.length > 0 && (
                <span className="ml-2 align-middle">
                  <ManaCost
                    cost={detail.colorIdentity.map((c) => `{${c}}`).join("")}
                    size="xs"
                  />
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-right">
            <span className="num text-[20px] font-semibold">
              {detail.totalCards}
              <span className="text-text-muted">/100</span>
            </span>
            <br />
            <span className="font-mono text-[11px] text-text-muted">
              ${detail.totalValueUsd.toFixed(2)}
            </span>
          </p>
          <Link href={`/decks/${id}`}>
            <Button size="sm" variant="outline">
              Open in builder
            </Button>
          </Link>
        </div>
      </header>

      {/* Headline row: bracket | completion | contention */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BracketPanel deckId={id} bracket={bracket} />
        <CompletionPanel
          deckId={id}
          result={reconcile}
          totalCards={detail.totalCards}
        />
        <ContentionPanel deckId={id} result={reconcile} />
      </div>

      {/* Lower row: gameplan | market movers | performance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GameplanPanel deckId={id} analysis={analysis} />
        <MarketMoversPanel movers={marketMovers} />
        <PerformancePanel
          stats={gameStats}
          calculatedBracket={bracket.calculatedBracket}
        />
      </div>
    </div>
  );
}
