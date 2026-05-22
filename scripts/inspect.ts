import { db } from "../src/db/client";
import { sql } from "drizzle-orm";

(async () => {
  const cardCount = await db.execute(sql`SELECT count(*)::int AS n FROM cards`);
  const printingCount = await db.execute(
    sql`SELECT count(*)::int AS n FROM printings`,
  );
  console.log("cards:", JSON.stringify(cardCount));
  console.log("printings:", JSON.stringify(printingCount));

  // Printings per set, most recent sets
  const sets = await db.execute(sql`
    SELECT set_code, count(*)::int AS n, max(released_at) AS released
    FROM printings
    GROUP BY set_code
    ORDER BY released DESC NULLS LAST
    LIMIT 25
  `);
  console.log("\nmost recent 25 sets by printing:");
  for (const s of sets as unknown as Array<{ set_code: string; n: number; released: unknown }>) {
    console.log(`  ${s.set_code}  ${s.n}  ${s.released}`);
  }

  // Is WOE present at all?
  const woe = await db.execute(sql`
    SELECT count(*)::int AS n FROM printings WHERE set_code = 'woe'
  `);
  console.log("\nWOE printings:", JSON.stringify(woe));

  // sync_state
  const syncState = await db.execute(sql`SELECT * FROM sync_state`);
  console.log("\nsync_state:", JSON.stringify(syncState, null, 2));
  process.exit(0);
})();
