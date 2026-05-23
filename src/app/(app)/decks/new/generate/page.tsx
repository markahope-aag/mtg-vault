import { GenerateEntry } from "@/components/rogue/generate-entry";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default function NewGeneratePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/decks" label="Decks" />
      </div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Generate a deck
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          The pipeline drafts ~62 nonland cards around a commander, runs the
          deterministic validator, repairs violations, computes the manabase,
          and finishes with a structured analysis. You can edit the draft
          before saving it as a real deck.
        </p>
      </header>
      <GenerateEntry />
    </div>
  );
}
