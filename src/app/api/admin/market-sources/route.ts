import { sql, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { marketSourcesTable } from "@/db/schema";
import { isHostileMarketplace } from "@/lib/market/sources/scraper/denylist";
import {
  createMarketSourceSchema,
  updateMarketSourceSchema,
} from "@/lib/market/schemas";
import { requireAdmin } from "@/lib/auth/require-admin";
import { serverError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  try {
    const rows = (await db.execute(sql`
      SELECT id, source_key, display_name, base_url, parser_template,
             enabled, robots_acknowledged, terms_notes,
             rate_limit_per_minute, rate_limit_per_day, use_web_unlocker,
             last_run_at, last_test_at, last_test_ok, last_test_message,
             created_at
      FROM market_sources
      ORDER BY display_name ASC
    `)) as unknown as Array<Record<string, unknown>>;
    return NextResponse.json({ sources: rows });
  } catch (err) {
    return serverError(
      "api/admin/market-sources GET",
      err,
      "Couldn't load market sources.",
    );
  }
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createMarketSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Denylist enforcement at the API boundary. The ScraperSource base
  // class re-checks at construction time; this is the user-facing
  // 400 so they get a clean error message in the admin UI.
  if (isHostileMarketplace(data.baseUrl)) {
    return NextResponse.json(
      {
        error:
          "That base URL targets a hostile marketplace (TCGPlayer / Cardmarket / eBay-the-site / similar). Scraper adapters cannot target those. Use the eBay Browse API adapter if you wanted eBay listings.",
      },
      { status: 400 },
    );
  }

  // Belt-and-suspenders: enabled requires robots_acknowledged.
  if (data.enabled && !data.robotsAcknowledged) {
    return NextResponse.json(
      {
        error:
          "Acknowledge the target's robots.txt + terms before enabling.",
      },
      { status: 400 },
    );
  }

  try {
    const [row] = await db
      .insert(marketSourcesTable)
      .values({
        sourceKey: data.sourceKey,
        displayName: data.displayName,
        baseUrl: data.baseUrl,
        parserTemplate: data.parserTemplate,
        enabled: data.enabled,
        robotsAcknowledged: data.robotsAcknowledged,
        termsNotes: data.termsNotes ?? null,
        rateLimitPerMinute: data.rateLimitPerMinute,
        rateLimitPerDay: data.rateLimitPerDay,
        useWebUnlocker: data.useWebUnlocker,
      })
      .returning({ id: marketSourcesTable.id });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    return serverError(
      "api/admin/market-sources POST",
      err,
      "Couldn't create that source.",
    );
  }
}

export async function PATCH(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateMarketSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id, ...rest } = parsed.data;

  const update: Record<string, unknown> = {};
  if ("enabled" in rest && rest.enabled !== undefined)
    update.enabled = rest.enabled;
  if ("robotsAcknowledged" in rest && rest.robotsAcknowledged !== undefined)
    update.robotsAcknowledged = rest.robotsAcknowledged;
  if ("termsNotes" in rest) update.termsNotes = rest.termsNotes;
  if ("rateLimitPerMinute" in rest && rest.rateLimitPerMinute !== undefined)
    update.rateLimitPerMinute = rest.rateLimitPerMinute;
  if ("rateLimitPerDay" in rest && rest.rateLimitPerDay !== undefined)
    update.rateLimitPerDay = rest.rateLimitPerDay;
  if ("useWebUnlocker" in rest && rest.useWebUnlocker !== undefined)
    update.useWebUnlocker = rest.useWebUnlocker;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    await db
      .update(marketSourcesTable)
      .set(update)
      .where(eq(marketSourcesTable.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(
      "api/admin/market-sources PATCH",
      err,
      "Couldn't update that source.",
    );
  }
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    await db
      .delete(marketSourcesTable)
      .where(eq(marketSourcesTable.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(
      "api/admin/market-sources DELETE",
      err,
      "Couldn't delete that source.",
    );
  }
}
