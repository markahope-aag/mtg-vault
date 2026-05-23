import { NewTradeForm } from "@/components/trades/new-trade-form";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default function NewTradePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/trades" label="Trades" />
      </div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Log a trade</h1>
        <p className="mt-1 text-sm text-text-muted">
          Record cards going both directions. Out-cards link to existing
          inventory rows and get marked disposed. In-cards create new
          inventory rows with the trade as the acquisition source.
        </p>
      </header>
      <NewTradeForm />
    </div>
  );
}
