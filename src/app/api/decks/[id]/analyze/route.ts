import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { decks } from "@/db/schema";
import { fetchDeckDetail } from "@/lib/decks/queries";
import {
  analyzeDeck,
  deckSignatureFromDetail,
  STRATEGY_MODEL,
  type DeckAnalysis,
} from "@/lib/ai/strategy";

export const dynamic = "force-dynamic";
// LLM call can take 15-60s. Bumped above 60s because a large analysis with
// the wider max_tokens budget occasionally pushed past the old limit, which
// caused Vercel to return an HTML error page instead of our JSON response.
export const maxDuration = 300;

type CachedResponse = {
  analysis: DeckAnalysis | null;
  model: string | null;
  signature: string | null;
  analyzedAt: string | null;
  currentSignature: string;
  isStale: boolean;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detail = await fetchDeckDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const row = await db
    .select({
      analysis: decks.analysis,
      analysisModel: decks.analysisModel,
      analysisSignature: decks.analysisSignature,
      analyzedAt: decks.analyzedAt,
    })
    .from(decks)
    .where(eq(decks.id, id))
    .limit(1);
  const current = row[0];
  const currentSignature = deckSignatureFromDetail(detail);
  const cached: CachedResponse = {
    analysis: (current?.analysis as DeckAnalysis | null) ?? null,
    model: current?.analysisModel ?? null,
    signature: current?.analysisSignature ?? null,
    analyzedAt: current?.analyzedAt
      ? new Date(current.analyzedAt).toISOString()
      : null,
    currentSignature,
    isStale:
      current?.analysisSignature != null &&
      current.analysisSignature !== currentSignature,
  };
  return NextResponse.json(cached);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured. Add it to .env.local to enable the strategy advisor.",
      },
      { status: 503 },
    );
  }
  const detail = await fetchDeckDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!detail.commander) {
    return NextResponse.json(
      { error: "Deck needs a commander before it can be analyzed." },
      { status: 422 },
    );
  }
  try {
    const analysis = await analyzeDeck(detail);
    const signature = deckSignatureFromDetail(detail);
    await db
      .update(decks)
      .set({
        analysis,
        analysisModel: STRATEGY_MODEL,
        analysisSignature: signature,
        analyzedAt: sql`now()`,
      })
      .where(eq(decks.id, id));
    const response: CachedResponse = {
      analysis,
      model: STRATEGY_MODEL,
      signature,
      analyzedAt: new Date().toISOString(),
      currentSignature: signature,
      isStale: false,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/decks analyze]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
