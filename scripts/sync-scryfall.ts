import { config } from "dotenv";
config({ path: ".env.local" });

import { syncScryfall, syncTutors } from "../src/lib/scryfall";
import { syncGameChangers } from "../src/lib/game-changers";

async function main() {
  const start = Date.now();

  console.log("=== 1/3 syncScryfall (bulk default_cards) ===");
  const bulk = await syncScryfall({ source: "local" });
  console.log("→", bulk);

  console.log("=== 2/3 syncTutors ===");
  const tutors = await syncTutors();
  console.log("→", tutors);

  console.log("=== 3/3 syncGameChangers ===");
  const gc = await syncGameChangers();
  console.log("→", gc);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
