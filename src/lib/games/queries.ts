import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { games, decks } from "@/db/schema";

export type GameListRow = {
  id: string;
  playedAt: string;
  myDeckId: string | null;
  myDeckName: string | null;
  podSize: number | null;
  myFinish: number | null;
  won: boolean | null;
  podBracket: number | null;
  winType: string | null;
  durationMinutes: number | null;
  opponentCount: number;
};

export type GameDetailRow = GameListRow & {
  notes: string | null;
  createdAt: string;
  players: Array<{
    id: string;
    isMe: boolean;
    playerName: string | null;
    commanderOracleId: string | null;
    commanderName: string | null;
    finish: number | null;
    knockedOutBy: string | null;
  }>;
};

export type ListGamesFilters = {
  deckId?: string;
  podBracket?: number;
  won?: boolean;
  from?: string;
  to?: string;
  limit?: number;
};

export async function listGames(
  filters: ListGamesFilters = {},
): Promise<GameListRow[]> {
  const conds = [];
  if (filters.deckId) conds.push(eq(games.myDeckId, filters.deckId));
  if (filters.podBracket != null)
    conds.push(eq(games.podBracket, filters.podBracket));
  if (filters.won != null) conds.push(eq(games.won, filters.won));
  if (filters.from) conds.push(gte(games.playedAt, new Date(filters.from)));
  if (filters.to) conds.push(lte(games.playedAt, new Date(filters.to)));

  const rows = await db
    .select({
      id: games.id,
      playedAt: games.playedAt,
      myDeckId: games.myDeckId,
      // COALESCE so a deck rename/delete still shows the historical name
      // — myDeckNameSnapshot is captured at log time precisely for this.
      myDeckName: sql<
        string | null
      >`COALESCE(${decks.name}, ${games.myDeckNameSnapshot})`,
      podSize: games.podSize,
      myFinish: games.myFinish,
      won: games.won,
      podBracket: games.podBracket,
      winType: games.winType,
      durationMinutes: games.durationMinutes,
      // count of non-me players for the list view
      opponentCount: sql<number>`(
        SELECT COUNT(*)::int FROM game_players gp
        WHERE gp.game_id = ${games.id} AND gp.is_me = false
      )`,
    })
    .from(games)
    .leftJoin(decks, eq(decks.id, games.myDeckId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(games.playedAt))
    .limit(filters.limit ?? 100);

  return rows.map((r) => ({
    ...r,
    playedAt: r.playedAt.toISOString(),
  }));
}

export async function getGame(id: string): Promise<GameDetailRow | null> {
  const rows = await db
    .select({
      id: games.id,
      playedAt: games.playedAt,
      myDeckId: games.myDeckId,
      myDeckName: sql<
        string | null
      >`COALESCE(${decks.name}, ${games.myDeckNameSnapshot})`,
      podSize: games.podSize,
      myFinish: games.myFinish,
      won: games.won,
      podBracket: games.podBracket,
      winType: games.winType,
      durationMinutes: games.durationMinutes,
      notes: games.notes,
      createdAt: games.createdAt,
    })
    .from(games)
    .leftJoin(decks, eq(decks.id, games.myDeckId))
    .where(eq(games.id, id))
    .limit(1);
  const g = rows[0];
  if (!g) return null;

  const playerRows = (await db.execute(sql`
    SELECT
      gp.id, gp.is_me, gp.player_name, gp.commander_oracle_id,
      gp.commander_name_snapshot, gp.finish, gp.knocked_out_by,
      c.name AS card_name
    FROM game_players gp
    LEFT JOIN cards c ON c.oracle_id = gp.commander_oracle_id
    WHERE gp.game_id = ${id}
    ORDER BY gp.is_me DESC, gp.finish ASC NULLS LAST
  `)) as unknown as Array<{
    id: string;
    is_me: boolean;
    player_name: string | null;
    commander_oracle_id: string | null;
    commander_name_snapshot: string | null;
    finish: number | null;
    knocked_out_by: string | null;
    card_name: string | null;
  }>;

  return {
    ...g,
    playedAt: g.playedAt.toISOString(),
    createdAt: g.createdAt.toISOString(),
    opponentCount: playerRows.filter((p) => !p.is_me).length,
    players: playerRows.map((p) => ({
      id: p.id,
      isMe: p.is_me,
      playerName: p.player_name,
      commanderOracleId: p.commander_oracle_id,
      commanderName: p.card_name ?? p.commander_name_snapshot,
      finish: p.finish,
      knockedOutBy: p.knocked_out_by,
    })),
  };
}

// ─── STATS ────────────────────────────────────────────────────────

export type DeckStats = {
  deckId: string;
  deckName: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  byBracket: Array<{
    podBracket: number;
    games: number;
    wins: number;
    winRatePct: number;
  }>;
  byWinType: Array<{ winType: string; count: number }>;
};

export type BracketRealityFlag = {
  deckId: string;
  deckName: string;
  calculatedBracket: number | null;
  podBracket: number;
  games: number;
  wins: number;
  winRatePct: number;
  // 'underperforming' = calculated bracket but losing badly at that level
  //   (deck may actually play below its sticker)
  // 'overperforming' = calculated bracket but winning a lot at that level
  //   (deck may be underbracketed; raise its target)
  signal: "underperforming" | "overperforming";
};

export type MatchupRow = {
  commanderOracleId: string;
  commanderName: string;
  games: number;
  wins: number;
  losses: number;
  winRatePct: number;
};

// The "killer insight" promised by the spec. Compares each deck's most
// recent calculated bracket (from deck_snapshots) against its actual W-L
// at that pod bracket. Flags lopsided records both ways — the deck might
// be playing below its sticker (under-) or above it (over-bracketed).
//
// Thresholds: needs >= 5 games at the bracket to call it. Under = win
// rate < 25%. Over = win rate > 75%. Keeps the noise off short samples.
export async function bracketRealityFlags(): Promise<BracketRealityFlag[]> {
  const rows = (await db.execute(sql`
    WITH latest_snap AS (
      SELECT DISTINCT ON (deck_id)
        deck_id, calculated_bracket, snapshot_at
      FROM deck_snapshots
      ORDER BY deck_id, snapshot_at DESC
    ),
    deck_perf AS (
      SELECT
        g.my_deck_id AS deck_id,
        g.pod_bracket,
        COUNT(*)::int AS games,
        SUM(CASE WHEN g.won THEN 1 ELSE 0 END)::int AS wins
      FROM games g
      WHERE g.my_deck_id IS NOT NULL
        AND g.pod_bracket IS NOT NULL
        AND g.won IS NOT NULL
      GROUP BY g.my_deck_id, g.pod_bracket
    )
    SELECT
      d.id AS deck_id,
      d.name AS deck_name,
      ls.calculated_bracket,
      dp.pod_bracket,
      dp.games,
      dp.wins,
      ROUND(100.0 * dp.wins / NULLIF(dp.games, 0), 1) AS win_rate_pct
    FROM deck_perf dp
    JOIN decks d ON d.id = dp.deck_id
    LEFT JOIN latest_snap ls ON ls.deck_id = dp.deck_id
    WHERE dp.games >= 5
      AND ls.calculated_bracket = dp.pod_bracket
      AND (
        (dp.wins::float / dp.games) < 0.25
        OR (dp.wins::float / dp.games) > 0.75
      )
    ORDER BY dp.games DESC
  `)) as unknown as Array<{
    deck_id: string;
    deck_name: string;
    calculated_bracket: number | null;
    pod_bracket: number;
    games: number;
    wins: number;
    win_rate_pct: string;
  }>;

  return rows.map((r) => {
    const rate = Number.parseFloat(r.win_rate_pct);
    return {
      deckId: r.deck_id,
      deckName: r.deck_name,
      calculatedBracket: r.calculated_bracket,
      podBracket: r.pod_bracket,
      games: r.games,
      wins: r.wins,
      winRatePct: rate,
      signal: rate < 25 ? "underperforming" : "overperforming",
    };
  });
}

export async function deckStats(deckId: string): Promise<DeckStats | null> {
  const deck = await db
    .select({ id: decks.id, name: decks.name })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);
  if (deck.length === 0) return null;

  const overall = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN won THEN 1 ELSE 0 END)::int AS wins,
      SUM(CASE WHEN won = false THEN 1 ELSE 0 END)::int AS losses
    FROM games
    WHERE my_deck_id = ${deckId} AND won IS NOT NULL
  `)) as unknown as Array<{ total: number; wins: number; losses: number }>;

  const byBracket = (await db.execute(sql`
    SELECT pod_bracket,
           COUNT(*)::int AS games,
           SUM(CASE WHEN won THEN 1 ELSE 0 END)::int AS wins
    FROM games
    WHERE my_deck_id = ${deckId}
      AND pod_bracket IS NOT NULL
      AND won IS NOT NULL
    GROUP BY pod_bracket
    ORDER BY pod_bracket ASC
  `)) as unknown as Array<{
    pod_bracket: number;
    games: number;
    wins: number;
  }>;

  const byWinType = (await db.execute(sql`
    SELECT win_type, COUNT(*)::int AS count
    FROM games
    WHERE my_deck_id = ${deckId}
      AND won = true
      AND win_type IS NOT NULL
    GROUP BY win_type
    ORDER BY count DESC
  `)) as unknown as Array<{ win_type: string; count: number }>;

  const total = overall[0]?.total ?? 0;
  const wins = overall[0]?.wins ?? 0;
  const losses = overall[0]?.losses ?? 0;

  return {
    deckId: deck[0].id,
    deckName: deck[0].name,
    totalGames: total,
    wins,
    losses,
    winRatePct: total > 0 ? Math.round((wins / total) * 1000) / 10 : null,
    byBracket: byBracket.map((r) => ({
      podBracket: r.pod_bracket,
      games: r.games,
      wins: r.wins,
      winRatePct: Math.round((r.wins / r.games) * 1000) / 10,
    })),
    byWinType: byWinType.map((r) => ({
      winType: r.win_type,
      count: r.count,
    })),
  };
}

// Matchups for a deck: aggregate W/L against each opponent commander
// the user has actually faced (and recorded). Only counts games where
// `won` is not null so partial logs don't dilute the picture.
export async function deckMatchups(deckId: string): Promise<MatchupRow[]> {
  const rows = (await db.execute(sql`
    SELECT
      c.oracle_id,
      c.name,
      COUNT(*)::int AS games,
      SUM(CASE WHEN g.won THEN 1 ELSE 0 END)::int AS wins,
      SUM(CASE WHEN g.won = false THEN 1 ELSE 0 END)::int AS losses
    FROM games g
    JOIN game_players gp
      ON gp.game_id = g.id
     AND gp.is_me = false
    JOIN cards c ON c.oracle_id = gp.commander_oracle_id
    WHERE g.my_deck_id = ${deckId}
      AND g.won IS NOT NULL
      AND gp.commander_oracle_id IS NOT NULL
    GROUP BY c.oracle_id, c.name
    HAVING COUNT(*) >= 2
    ORDER BY games DESC, wins ASC
    LIMIT 50
  `)) as unknown as Array<{
    oracle_id: string;
    name: string;
    games: number;
    wins: number;
    losses: number;
  }>;

  return rows.map((r) => ({
    commanderOracleId: r.oracle_id,
    commanderName: r.name,
    games: r.games,
    wins: r.wins,
    losses: r.losses,
    winRatePct: Math.round((r.wins / r.games) * 1000) / 10,
  }));
}
