/**
 * Scraper URL denylist.
 *
 * Two reasons a scraper URL is refused at adapter-construction time:
 *
 * 1. HOSTILE MARKETPLACE — anti-bot sites whose pricing data is their
 *    commercial product and whose ToS explicitly prohibits scraping.
 *    eBay is on the list because the official Browse API covers the
 *    same signal legitimately; there's never a reason to scrape it.
 *
 * 2. SSRF TARGET — private / loopback / link-local / cloud-metadata
 *    hostnames + IP ranges. Even though an admin sets the URL (and
 *    admin trust is the auth boundary for that mutation), it's still
 *    free to refuse 169.254.169.254 (AWS/GCP/Azure metadata),
 *    127.0.0.1, 10.x, 172.16-31.x, 192.168.x, ::1, fc00::/7, etc.
 *    A misclick or copy-paste from internal docs shouldn't be the
 *    failure mode that exfiltrates IAM creds.
 *
 * Both checks run from the ScraperSource constructor + the admin
 * POST/PATCH route, so a forbidden target fails loudly at boot.
 */

const HOSTILE_MARKETPLACE_DOMAINS = new Set([
  // The big card marketplaces — their data is their product.
  "tcgplayer.com",
  "magic.tcgplayer.com",
  "shop.tcgplayer.com",
  "cardmarket.com",
  "www.cardmarket.com",
  // eBay site — use the eBay API adapter instead.
  "ebay.com",
  "www.ebay.com",
  "ebay.co.uk",
  // Big aggregator-style scrape targets aren't worth the legal risk.
  "mtgstocks.com",
]);

// Hostnames that resolve to network locations no public scraper should
// touch. The cloud-metadata cases (169.254.169.254, metadata.google.*,
// metadata.azure.com) are the SSRF jackpot — IAM credentials live behind
// those endpoints.
const SSRF_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  // Cloud metadata endpoints
  "metadata.google.internal",
  "metadata.azure.com",
]);

export class HostileMarketplaceError extends Error {
  constructor(hostname: string) {
    const note =
      hostname.endsWith("ebay.com") || hostname.endsWith("ebay.co.uk")
        ? " Use the eBay Browse API adapter (sources/ebay.ts) instead."
        : "";
    super(
      `Scraper adapters cannot target "${hostname}" — it's an anti-bot-` +
        `hostile marketplace whose terms explicitly prohibit scraping its ` +
        `commercial pricing data.${note}`,
    );
    this.name = "HostileMarketplaceError";
  }
}

export class UnsafeUrlError extends Error {
  constructor(hostname: string, reason: string) {
    super(
      `Scraper adapters cannot target "${hostname}" — ${reason}. ` +
        `Private, loopback, link-local, and cloud-metadata endpoints ` +
        `are denylisted at adapter construction time.`,
    );
    this.name = "UnsafeUrlError";
  }
}

// ─── IP / hostname checks ────────────────────────────────────────

function ipv4Octets(host: string): number[] | null {
  // Strict IPv4 parse: four decimal octets 0-255.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = m.slice(1, 5).map((s) => Number.parseInt(s, 10));
  if (octets.some((o) => o < 0 || o > 255 || Number.isNaN(o))) return null;
  return octets;
}

function isPrivateOrSpecialIpv4(host: string): string | null {
  const octets = ipv4Octets(host);
  if (!octets) return null;
  const [a, b] = octets;
  if (a === 10) return "RFC1918 (10.0.0.0/8)";
  if (a === 127) return "loopback (127.0.0.0/8)";
  if (a === 0) return "this-network (0.0.0.0/8)";
  if (a === 169 && b === 254)
    return "link-local incl. cloud-metadata (169.254.0.0/16)";
  if (a === 172 && b >= 16 && b <= 31) return "RFC1918 (172.16.0.0/12)";
  if (a === 192 && b === 168) return "RFC1918 (192.168.0.0/16)";
  if (a >= 224 && a <= 239) return "multicast (224.0.0.0/4)";
  if (a >= 240) return "reserved (240.0.0.0/4)";
  return null;
}

function isLoopbackOrPrivateIpv6(host: string): string | null {
  // IPv6 literals come bracketed inside URLs ([::1], [fe80::1]). The URL
  // parser strips the brackets when reading hostname, so we get bare
  // forms here. Cheap structural checks; we don't need a full IPv6
  // parser, just the well-known private ranges.
  if (host === "::1" || host === "::") return "loopback (::1)";
  if (/^fe80:/i.test(host)) return "link-local (fe80::/10)";
  if (/^fc[0-9a-f]{2}:/i.test(host)) return "unique-local (fc00::/7)";
  if (/^fd[0-9a-f]{2}:/i.test(host)) return "unique-local (fd00::/8)";
  return null;
}

function isUnsafeHostname(host: string): string | null {
  if (SSRF_HOSTNAMES.has(host)) return `private hostname (${host})`;
  if (host.endsWith(".localhost")) return "localhost subdomain";
  if (host.endsWith(".internal")) return "internal-only TLD";
  if (host.endsWith(".local")) return "mDNS .local TLD";

  const v4 = isPrivateOrSpecialIpv4(host);
  if (v4) return v4;
  const v6 = isLoopbackOrPrivateIpv6(host);
  if (v6) return v6;
  return null;
}

// ─── Public entry points ─────────────────────────────────────────

/**
 * Throws HostileMarketplaceError if the URL's hostname matches a
 * denylisted marketplace, or UnsafeUrlError if it points at a
 * private / loopback / metadata endpoint. Called from the
 * ScraperSource constructor and the admin POST/PATCH route.
 */
export function assertNotHostileMarketplace(baseUrl: string): void {
  let hostname: string;
  let protocol: string;
  try {
    const u = new URL(baseUrl);
    // Node's URL parser keeps [brackets] on IPv6 hostnames
    // ("[::1]"). Strip them so the IPv6 range checks see "::1" /
    // "fe80::1" / etc.
    hostname = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    protocol = u.protocol;
  } catch {
    // If the URL doesn't parse, leave it to the adapter to error on actual
    // use — we don't want denylist enforcement to be the place that
    // crashes on malformed input.
    return;
  }

  // Reject non-http(s) schemes outright — file://, ftp://, gopher://,
  // data:, javascript: have no business here.
  if (protocol !== "http:" && protocol !== "https:") {
    throw new UnsafeUrlError(hostname || baseUrl, `unsupported scheme "${protocol}"`);
  }

  const canonical = hostname.replace(/^www\./, "");
  if (
    HOSTILE_MARKETPLACE_DOMAINS.has(hostname) ||
    HOSTILE_MARKETPLACE_DOMAINS.has(canonical)
  ) {
    throw new HostileMarketplaceError(canonical);
  }

  const unsafe = isUnsafeHostname(hostname);
  if (unsafe) {
    throw new UnsafeUrlError(hostname, unsafe);
  }
}

/** Exposed for tests + the admin UI's pre-create check. */
export function isHostileMarketplace(baseUrl: string): boolean {
  try {
    assertNotHostileMarketplace(baseUrl);
    return false;
  } catch {
    return true;
  }
}
