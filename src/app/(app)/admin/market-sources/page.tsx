import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { AVAILABLE_PARSER_TEMPLATES } from "@/lib/market/sources/scraper/loader";
import { MarketSourcesAdmin } from "@/components/admin/market-sources-admin";
import { BackLink } from "@/components/back-link";
import { requireAdminUser } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function MarketSourcesAdminPage() {
  await requireAdminUser();
  const rows = (await db.execute(sql`
    SELECT id, source_key, display_name, base_url, parser_template,
           enabled, robots_acknowledged, terms_notes,
           rate_limit_per_minute, rate_limit_per_day, use_web_unlocker,
           last_run_at, last_test_at, last_test_ok, last_test_message
    FROM market_sources
    ORDER BY display_name ASC
  `)) as unknown as Array<{
    id: string;
    source_key: string;
    display_name: string;
    base_url: string;
    parser_template: string;
    enabled: boolean;
    robots_acknowledged: boolean;
    terms_notes: string | null;
    rate_limit_per_minute: number;
    rate_limit_per_day: number;
    use_web_unlocker: boolean;
    last_run_at: string | null;
    last_test_at: string | null;
    last_test_ok: boolean | null;
    last_test_message: string | null;
  }>;

  const sources = rows.map((r) => ({
    id: r.id,
    sourceKey: r.source_key,
    displayName: r.display_name,
    baseUrl: r.base_url,
    parserTemplate: r.parser_template,
    enabled: r.enabled,
    robotsAcknowledged: r.robots_acknowledged,
    termsNotes: r.terms_notes,
    rateLimitPerMinute: r.rate_limit_per_minute,
    rateLimitPerDay: r.rate_limit_per_day,
    useWebUnlocker: r.use_web_unlocker,
    lastRunAt: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
    lastTestAt: r.last_test_at ? new Date(r.last_test_at).toISOString() : null,
    lastTestOk: r.last_test_ok,
    lastTestMessage: r.last_test_message,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/market" label="Market" />
      </div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Market sources
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Per-source scraper adapters. Each row is a friendly LGS, vendor,
          or price-reference site you&rsquo;ve reviewed for robots.txt + terms
          compliance. Big hostile marketplaces (TCGPlayer / Cardmarket /
          eBay-the-site) are denylisted; the eBay API adapter handles eBay
          legitimately.
        </p>
      </header>

      <MarketSourcesAdmin
        sources={sources}
        templates={AVAILABLE_PARSER_TEMPLATES}
      />
    </div>
  );
}
