import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { marketSourcesTable } from "@/db/schema";
import { ShopifyTemplate } from "@/lib/market/sources/scraper/templates/shopify";
import { requireAdmin } from "@/lib/auth/require-admin";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEMPLATES = {
  shopify: ShopifyTemplate,
} as const;

/**
 * Manual "test fetch" for a single source. Runs a hardcoded query
 * ("Sol Ring") through the adapter and stores the result on the
 * market_sources row for surfacing on the admin page.
 *
 * Intentionally NOT honoring the row's enabled flag — the whole point
 * of test-fetch is to validate before flipping enabled to true.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  try {
    const rows = await db
      .select()
      .from(marketSourcesTable)
      .where(eq(marketSourcesTable.id, id))
      .limit(1);
    const source = rows[0];
    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const TemplateClass = TEMPLATES[source.parserTemplate as keyof typeof TEMPLATES];
    if (!TemplateClass) {
      return NextResponse.json(
        { error: `Unknown parser template "${source.parserTemplate}".` },
        { status: 400 },
      );
    }

    let listingCount = 0;
    let firstFew: Array<{ title: string; priceUsd: number; url: string }> = [];
    let ok = false;
    let message = "";

    try {
      const adapter = new TemplateClass({
        sourceKey: source.sourceKey,
        displayName: source.displayName,
        baseUrl: source.baseUrl,
        // Force-enable for the test, regardless of the persisted flag.
        // robotsAcknowledged still gates: refusing to test a source
        // without acknowledgment matches the production refusal.
        enabled: source.robotsAcknowledged,
        robotsAcknowledged: source.robotsAcknowledged,
        rateLimitPerMinute: source.rateLimitPerMinute,
        rateLimitPerDay: source.rateLimitPerDay,
        useWebUnlocker: source.useWebUnlocker,
      });
      if (!adapter.enabled) {
        ok = false;
        message =
          "robots.txt / terms acknowledgment required before testing.";
      } else {
        const listings = await adapter.search({
          name: "Sol Ring",
          limit: 10,
        });
        listingCount = listings.length;
        firstFew = listings.slice(0, 3).map((l) => ({
          title: l.rawTitle,
          priceUsd: l.priceUsd,
          url: l.url,
        }));
        ok = listingCount > 0;
        message = ok
          ? `Returned ${listingCount} listing(s).`
          : "Adapter ran without errors but returned 0 listings. Check the URL or template.";
      }
    } catch (err) {
      ok = false;
      message =
        err instanceof Error
          ? `Adapter threw: ${err.message}`
          : "Adapter threw an unknown error.";
    }

    await db
      .update(marketSourcesTable)
      .set({
        lastTestAt: sql`now()`,
        lastTestOk: ok,
        lastTestMessage: message,
      })
      .where(eq(marketSourcesTable.id, id));

    return NextResponse.json({ ok, message, listingCount, firstFew });
  } catch (err) {
    return serverError(
      "api/admin/market-sources/id/test",
      err,
      "Test fetch failed.",
    );
  }
}
