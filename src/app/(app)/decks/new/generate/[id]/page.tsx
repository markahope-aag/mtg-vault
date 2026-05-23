import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { deckProposals } from "@/db/schema";
import { GenerationProgress } from "@/components/rogue/generation-progress";
import { ProposalView } from "@/components/rogue/proposal-view";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(deckProposals)
    .where(eq(deckProposals.id, id))
    .limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/decks" label="Decks" />
      </div>
      {/* The proposal page rehydrates on the client so we can poll while
          the pipeline runs. When status flips to 'ready' the client swaps
          to the editable proposal view. */}
      {proposal.status === "generating" ? (
        <GenerationProgress proposalId={id} />
      ) : (
        <ProposalView proposalId={id} initial={proposal} />
      )}
    </div>
  );
}
