import { sql } from "drizzle-orm";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { db } from "@/db/client";
import { toIso } from "@/lib/utils";
import { LocationsManager } from "@/components/system/locations-manager";

export const dynamic = "force-dynamic";

type Counts = {
  card_count: number;
  printing_count: number;
  price_rows: number;
};
type FlagCounts = {
  gc: number;
  tutor: number;
  mld: number;
  extra_turn: number;
  cmdr_legal: number;
  reserved: number;
};
type NewestSet = {
  set_name: string;
  set_code: string;
  released_at: unknown;
};
type SyncRow = { key: string; value: unknown; updated_at: unknown };
type InvRow = { active: number; disposed: number; distinct_printings: number };
type DeckRow = { total: number; analyzed: number };
type ImportRow = {
  batches: number;
  total_imported: number;
  last_import: unknown;
};
type SnapRow = { n: number; latest_date: string | null };

function relative(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor(diffMs / 60_000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default async function SystemPage() {
  const [
    countsRows,
    flagRows,
    newestRows,
    syncRows,
    invRows,
    deckRows,
    importRows,
    snapRows,
  ] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM cards) AS card_count,
        (SELECT count(*)::int FROM printings) AS printing_count,
        (SELECT count(*)::int FROM price_history) AS price_rows
    `),
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE is_game_changer)::int AS gc,
        count(*) FILTER (WHERE is_tutor)::int AS tutor,
        count(*) FILTER (WHERE is_mass_land_denial)::int AS mld,
        count(*) FILTER (WHERE is_extra_turn)::int AS extra_turn,
        count(*) FILTER (WHERE is_commander_legal)::int AS cmdr_legal,
        count(*) FILTER (WHERE is_reserved_list)::int AS reserved
      FROM cards
    `),
    db.execute(sql`
      SELECT set_name, set_code, released_at
      FROM printings
      WHERE released_at IS NOT NULL
      ORDER BY released_at DESC
      LIMIT 1
    `),
    db.execute(sql`SELECT key, value, updated_at FROM sync_state`),
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE disposed_at IS NULL)::int AS active,
        count(*) FILTER (WHERE disposed_at IS NOT NULL)::int AS disposed,
        count(DISTINCT printing_id)::int AS distinct_printings
      FROM inventory
    `),
    db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE analysis IS NOT NULL)::int AS analyzed
      FROM decks
    `),
    db.execute(sql`
      SELECT
        count(*)::int AS batches,
        COALESCE(sum(imported_rows), 0)::int AS total_imported,
        max(created_at) AS last_import
      FROM import_batches
    `),
    db.execute(sql`
      SELECT count(*)::int AS n, max(date) AS latest_date
      FROM collection_snapshots
    `),
  ]);

  const counts = (countsRows as unknown as Counts[])[0];
  const flags = (flagRows as unknown as FlagCounts[])[0];
  const newest = (newestRows as unknown as NewestSet[])[0] ?? null;
  const sync = syncRows as unknown as SyncRow[];
  const inv = (invRows as unknown as InvRow[])[0];
  const decks = (deckRows as unknown as DeckRow[])[0];
  const imports = (importRows as unknown as ImportRow[])[0];
  const snaps = (snapRows as unknown as SnapRow[])[0];

  const cardSync = sync.find((s) => s.key === "scryfall_default_cards");
  const cardSyncAt = toIso(
    (cardSync?.value as { updatedAt?: string } | undefined)?.updatedAt ??
      cardSync?.updated_at ??
      null,
  );
  const flagSync = sync.find((s) => s.key === "bracket_flags_last_refreshed");
  const flagSyncValue = flagSync?.value as
    | {
        refreshedAt?: string;
        errors?: Array<{ step: string; message: string }>;
      }
    | undefined;
  const flagSyncAt = toIso(flagSyncValue?.refreshedAt ?? flagSync?.updated_at ?? null);
  const flagErrors = flagSyncValue?.errors ?? [];

  // Card sync older than 9 days = the weekly GitHub Action likely missed a run.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const cardSyncStale =
    cardSyncAt != null &&
    now - new Date(cardSyncAt).getTime() > 9 * 86_400_000;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <header className="space-y-2 border-b border-[var(--border-subtle)] pb-5">
        <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          System
        </p>
        <h1 className="font-[var(--font-display)] text-[44px] font-semibold leading-[1.05] tracking-tight">
          System status
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          Data freshness, sync health, and collection metrics.
        </p>
      </header>

      {/* Card database */}
      <Section label="01" title="Card database">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Cards" value={counts.card_count.toLocaleString()} />
          <Stat
            label="Printings"
            value={counts.printing_count.toLocaleString()}
          />
          <Stat
            label="Price points"
            value={counts.price_rows.toLocaleString()}
          />
          <Stat
            label="Newest set"
            value={newest ? newest.set_code.toUpperCase() : "—"}
            sub={
              newest
                ? new Date(toIso(newest.released_at) ?? "").toLocaleDateString()
                : undefined
            }
          />
          <Stat
            label="Last full sync"
            value={relative(cardSyncAt)}
            sub={
              cardSyncAt
                ? new Date(cardSyncAt).toLocaleString()
                : "no completed sync"
            }
            tone={cardSyncStale ? "warn" : "ok"}
          />
        </div>
        {cardSyncStale && (
          <Banner tone="warn">
            The full card sync is more than 9 days old — the weekly GitHub
            Action may have failed. Trigger it manually from the repo Actions
            tab.
          </Banner>
        )}
      </Section>

      {/* Bracket flags */}
      <Section label="02" title="Bracket flags">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Game changers" value={flags.gc.toLocaleString()} />
          <Stat label="Tutors" value={flags.tutor.toLocaleString()} />
          <Stat label="Mass land denial" value={flags.mld.toLocaleString()} />
          <Stat label="Extra turn" value={flags.extra_turn.toLocaleString()} />
          <Stat
            label="Commander legal"
            value={flags.cmdr_legal.toLocaleString()}
          />
          <Stat label="Reserved list" value={flags.reserved.toLocaleString()} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            Last flag refresh: {relative(flagSyncAt)}
            {flagSyncAt
              ? ` · ${new Date(flagSyncAt).toLocaleString()}`
              : ""}
          </p>
        </div>
        {flagErrors.length > 0 ? (
          <Banner tone="warn">
            {flagErrors.length} error
            {flagErrors.length === 1 ? "" : "s"} in the last flag refresh:{" "}
            {flagErrors.map((e) => e.step).join(", ")}
          </Banner>
        ) : (
          <Banner tone="ok">Last flag refresh completed with no errors.</Banner>
        )}
      </Section>

      {/* Collection */}
      <Section label="03" title="Collection &amp; activity">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Inventory rows" value={inv.active.toLocaleString()} />
          <Stat label="Disposed rows" value={inv.disposed.toLocaleString()} />
          <Stat
            label="Distinct printings"
            value={inv.distinct_printings.toLocaleString()}
          />
          <Stat label="Decks" value={decks.total.toLocaleString()} />
          <Stat
            label="Decks analyzed"
            value={`${decks.analyzed}/${decks.total}`}
          />
          <Stat
            label="Daily snapshots"
            value={snaps.n.toLocaleString()}
            sub={snaps.latest_date ? `latest ${snaps.latest_date}` : undefined}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Import batches"
            value={imports.batches.toLocaleString()}
          />
          <Stat
            label="Rows imported"
            value={imports.total_imported.toLocaleString()}
          />
          <Stat
            label="Last import"
            value={relative(toIso(imports.last_import))}
          />
        </div>
      </Section>

      {/* Locations */}
      <Section label="04" title="Locations">
        <p className="text-[13px] text-[var(--text-secondary)]">
          Storage locations available when adding or editing inventory cards.
          Deleting a location only removes it from the dropdown — existing
          inventory rows keep the value.
        </p>
        <LocationsManager />
      </Section>
    </div>
  );
}

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--brand)]">
          {label}
        </p>
        <h2 className="font-[var(--font-display)] text-[22px] font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2.5">
      <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={`num mt-1 text-[20px] font-semibold leading-none ${
          tone === "warn"
            ? "text-[var(--value-negative)]"
            : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 font-[var(--font-mono)] text-[10px] text-[var(--text-muted)]">
          {sub}
        </p>
      )}
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "ok" | "warn";
  children: React.ReactNode;
}) {
  const Icon = tone === "warn" ? AlertTriangle : CheckCircle2;
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] ${
        tone === "warn"
          ? "border-[var(--value-negative)]/30 bg-[var(--value-negative)]/10 text-[var(--value-negative)]"
          : "border-[var(--value-positive)]/30 bg-[var(--value-positive)]/10 text-[var(--value-positive)]"
      }`}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
