import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards } from "@/db/schema";

const SCRYFALL_HEADERS = {
  "User-Agent": "MTG-Vault/0.1 (personal use)",
  Accept: "application/json",
};
const SCRYFALL_DELAY_MS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchScryfall(url: string): Promise<Response> {
  const res = await fetch(url, { headers: SCRYFALL_HEADERS });
  if (!res.ok) {
    throw new Error(`Scryfall ${res.status} ${res.statusText}: ${url}`);
  }
  return res;
}

export async function syncGameChangers() {
  console.log("[game-changers] syncing");
  let nextUrl: string | null =
    "https://api.scryfall.com/cards/search?q=is%3Agamechanger&unique=cards";
  const oracleIds = new Set<string>();

  while (nextUrl) {
    const data = (await fetchScryfall(nextUrl).then((r) => r.json())) as {
      data: Array<{ oracle_id?: string }>;
      has_more: boolean;
      next_page?: string;
    };
    for (const c of data.data ?? []) {
      if (c.oracle_id) oracleIds.add(c.oracle_id);
    }
    nextUrl = data.has_more && data.next_page ? data.next_page : null;
    if (nextUrl) await sleep(SCRYFALL_DELAY_MS);
  }

  await db.update(cards).set({ isGameChanger: false });
  if (oracleIds.size > 0) {
    await db
      .update(cards)
      .set({ isGameChanger: true })
      .where(sql`oracle_id = ANY(${[...oracleIds]}::uuid[])`);
  }

  console.log(`[game-changers] set: ${oracleIds.size}`);
  return { count: oracleIds.size };
}
