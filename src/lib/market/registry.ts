/**
 * Side-effecting import that registers every adapter. Anywhere that
 * needs to use the market layer should import this module + call
 * ensureSourcesLoaded() to populate the registry.
 *
 * Built-in adapters (eBay) self-register via module side-effect on
 * import. DB-defined scraper adapters need to be loaded explicitly
 * since they pull config rows from market_sources.
 */
import "./sources/ebay";
import { loadScraperSources } from "./sources/scraper/loader";

export { marketSources } from "./source";

// Lazy + once-only. Idempotent — the loader registers idempotently
// against the registry's duplicate guard.
let loadedPromise: Promise<void> | null = null;
export function ensureSourcesLoaded(): Promise<void> {
  if (!loadedPromise) {
    loadedPromise = loadScraperSources();
  }
  return loadedPromise;
}
