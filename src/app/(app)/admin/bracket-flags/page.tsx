import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { syncState } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { RefreshButton } from "./refresh-button";

export const dynamic = "force-dynamic";

type SampleRow = { oracle_id: string; name: string; type_line: string | null };
type AuditCard = {
  oracleId: string;
  name: string;
  typeLine: string | null;
  oracleText: string | null;
};

async function counts(): Promise<{
  gameChanger: number;
  extraTurn: number;
  mld: number;
  tutor: number;
}> {
  const rows = (await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM cards WHERE is_game_changer = true) AS game_changer,
      (SELECT COUNT(*)::int FROM cards WHERE is_extra_turn = true) AS extra_turn,
      (SELECT COUNT(*)::int FROM cards WHERE is_mass_land_denial = true) AS mld,
      (SELECT COUNT(*)::int FROM cards WHERE is_tutor = true) AS tutor
  `)) as unknown as Array<{
    game_changer: number;
    extra_turn: number;
    mld: number;
    tutor: number;
  }>;
  const r = rows[0] ?? { game_changer: 0, extra_turn: 0, mld: 0, tutor: 0 };
  return {
    gameChanger: r.game_changer,
    extraTurn: r.extra_turn,
    mld: r.mld,
    tutor: r.tutor,
  };
}

async function sample(flag: string): Promise<SampleRow[]> {
  const rows = (await db.execute(sql`
    SELECT oracle_id, name, type_line
    FROM cards
    WHERE ${sql.raw(flag)} = true
    ORDER BY random()
    LIMIT 10
  `)) as unknown as SampleRow[];
  return rows;
}

async function lastRefreshed(): Promise<{
  refreshedAt: string;
  values: Record<string, unknown>;
} | null> {
  const rows = await db
    .select()
    .from(syncState)
    .where(eq(syncState.key, "bracket_flags_last_refreshed"))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    refreshedAt: r.updatedAt.toISOString(),
    values: (r.value as Record<string, unknown>) ?? {},
  };
}

async function fetchAudit(): Promise<{
  extraTurnSuspicious: AuditCard[];
  extraTurnFalsePositive: AuditCard[];
  mldMissingFromCurated: AuditCard[];
  tutorMissing: AuditCard[];
} | null> {
  // Call our own audit endpoint via fetch is unreliable in a server component
  // (auth cookies, base URL). Inline the query helper instead.
  try {
    const audit = await import("@/app/api/admin/bracket-flag-audit/route");
    const res = await audit.GET();
    if (!res.ok) return null;
    return (await res.json()) as {
      extraTurnSuspicious: AuditCard[];
      extraTurnFalsePositive: AuditCard[];
      mldMissingFromCurated: AuditCard[];
      tutorMissing: AuditCard[];
    };
  } catch {
    return null;
  }
}

export default async function BracketFlagsAdmin() {
  await requireAdminUser();

  const [c, last, audit] = await Promise.all([
    counts(),
    lastRefreshed(),
    fetchAudit(),
  ]);

  const [gcSamples, etSamples, mldSamples, tutorSamples] = await Promise.all([
    sample("is_game_changer"),
    sample("is_extra_turn"),
    sample("is_mass_land_denial"),
    sample("is_tutor"),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bracket flags
          </h1>
          <p className="text-sm text-muted-foreground">
            Last refreshed:{" "}
            {last ? new Date(last.refreshedAt).toLocaleString() : "never"}
          </p>
        </div>
        <RefreshButton />
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <FlagCount
          label="Game Changers"
          count={c.gameChanger}
          expected="~50-55"
          samples={gcSamples}
        />
        <FlagCount
          label="Extra Turn"
          count={c.extraTurn}
          expected="~30-40"
          samples={etSamples}
        />
        <FlagCount
          label="Mass Land Denial"
          count={c.mld}
          expected="curated list"
          samples={mldSamples}
        />
        <FlagCount
          label="Tutors"
          count={c.tutor}
          expected="~150-250"
          samples={tutorSamples}
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Audit</h2>
        {!audit ? (
          <p className="text-sm text-muted-foreground">
            Audit data unavailable.
          </p>
        ) : (
          <>
            <AuditList
              title="Extra turn — suspicious (oracle text contains 'extra turn' but flag is off)"
              cards={audit.extraTurnSuspicious}
              empty="None — extra-turn flag looks correct."
            />
            <AuditList
              title="Extra turn — false positive"
              cards={audit.extraTurnFalsePositive}
              empty="None."
            />
            <AuditList
              title="MLD — missing from curated list"
              cards={audit.mldMissingFromCurated}
              empty="None — curated MLD list covers known phrasings."
            />
            <AuditList
              title="Tutors — possibly missing (informational)"
              cards={audit.tutorMissing}
              empty="None."
            />
          </>
        )}
      </section>
    </div>
  );
}

function FlagCount({
  label,
  count,
  expected,
  samples,
}: {
  label: string;
  count: number;
  expected: string;
  samples: SampleRow[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold tabular-nums">{count}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          expected {expected}
        </p>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Show sample (10)
          </summary>
          <ul className="mt-1 space-y-0.5 text-[11px]">
            {samples.map((s) => (
              <li key={s.oracle_id} className="truncate">
                <Link
                  href={`/cards/${s.oracle_id}`}
                  className="hover:underline"
                >
                  {s.name}
                </Link>{" "}
                <span className="text-muted-foreground">— {s.type_line}</span>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

function AuditList({
  title,
  cards,
  empty,
}: {
  title: string;
  cards: AuditCard[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {title}{" "}
          <span className="font-normal text-muted-foreground">
            ({cards.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {cards.map((c) => (
              <li key={c.oracleId} className="truncate">
                <Link
                  href={`/cards/${c.oracleId}`}
                  className="font-medium hover:underline"
                >
                  {c.name}
                </Link>{" "}
                <span className="text-muted-foreground">— {c.typeLine}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
