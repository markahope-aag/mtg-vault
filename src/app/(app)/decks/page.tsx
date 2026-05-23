import Link from "next/link";
import { sql } from "drizzle-orm";
import { listDecks } from "@/lib/decks/queries";
import { db } from "@/db/client";
import { DecksHeader } from "./decks-header";
import { DeckCardTile } from "@/components/decks/deck-card-tile";
import { BuilderList, type BuilderProposal } from "@/components/rogue/builder-list";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function fetchBuilderProposals(): Promise<BuilderProposal[]> {
  // Anything that isn't a fully-saved deck shows up in the Builder tab.
  // Saved proposals exit Builder; their analysis lives with the deck.
  const rows = (await db.execute(sql`
    SELECT
      p.id, p.kind, p.status, p.target_bracket, p.archetype_brief,
      p.commander_oracle_id, p.created_at, p.saved_deck_id,
      c.name AS commander_name,
      (
        SELECT COALESCE(
          pr.image_uris ->> 'small',
          pr.card_faces -> 0 -> 'image_uris' ->> 'small',
          c.card_faces -> 0 -> 'image_uris' ->> 'small'
        )
        FROM printings pr
        WHERE pr.oracle_id = p.commander_oracle_id
        ORDER BY pr.released_at DESC NULLS LAST, pr.set_code
        LIMIT 1
      ) AS commander_image_uri,
      (
        SELECT jsonb_array_length(p.card_list)
        WHERE p.card_list IS NOT NULL
      ) AS card_count
    FROM deck_proposals p
    LEFT JOIN cards c ON c.oracle_id = p.commander_oracle_id
    WHERE p.status <> 'saved'
    ORDER BY p.created_at DESC
    LIMIT 200
  `)) as unknown as Array<{
    id: string;
    kind: string;
    status: string;
    target_bracket: number | null;
    archetype_brief: string | null;
    commander_oracle_id: string | null;
    commander_name: string | null;
    commander_image_uri: string | null;
    created_at: string;
    saved_deck_id: string | null;
    card_count: number | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status as BuilderProposal["status"],
    targetBracket: r.target_bracket,
    archetypeBrief: r.archetype_brief,
    commanderOracleId: r.commander_oracle_id,
    commanderName: r.commander_name,
    commanderImageUri: r.commander_image_uri,
    createdAt: new Date(r.created_at).toISOString(),
    cardCount: r.card_count ?? 0,
  }));
}

export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab: "active" | "builder" =
    tab === "builder" ? "builder" : "active";

  const [decks, proposals] = await Promise.all([
    listDecks({ sort: "updatedAt", direction: "desc", filters: {} }),
    fetchBuilderProposals(),
  ]);
  const totalValue = decks.reduce((s, d) => s + d.totalValueUsd, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <DecksHeader count={decks.length} totalValueUsd={totalValue} />

      <nav className="flex items-center gap-1 border-b border-border-subtle">
        <TabLink
          href="/decks?tab=active"
          active={activeTab === "active"}
          label="Active"
          count={decks.length}
        />
        <TabLink
          href="/decks?tab=builder"
          active={activeTab === "builder"}
          label="Builder"
          count={proposals.length}
          tone={
            proposals.some((p) => p.status === "generating")
              ? "live"
              : undefined
          }
        />
      </nav>

      {activeTab === "active" ? (
        decks.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 p-12 text-center">
            <p className="empty-terminal">no decks recorded</p>
            <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
              Create one to start tracking what you&rsquo;re building.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((d) => (
              <DeckCardTile key={d.id} deck={d} />
            ))}
          </div>
        )
      ) : (
        <BuilderList proposals={proposals} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
  count,
  tone,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tone?: "live";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors",
        active
          ? "border-[var(--brand)] text-text-primary"
          : "border-transparent text-text-muted hover:text-text-primary",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[10px] tabular-nums",
          active
            ? "bg-[var(--color-brand-soft)] text-[var(--brand)]"
            : "bg-surface-inset text-text-muted",
          tone === "live" && "animate-pulse",
        )}
      >
        {count}
      </span>
    </Link>
  );
}
