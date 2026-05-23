/**
 * Side-effecting import that registers every adapter. Anywhere that
 * needs to use the market layer should import this module to ensure
 * the registry is populated before iterating it.
 *
 * Currently just eBay. Future per-source adapters (LGS webstores, etc.)
 * register here too.
 */
import "./sources/ebay";
export { marketSources } from "./source";
