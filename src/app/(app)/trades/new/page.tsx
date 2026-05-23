import { TransactionForm } from "@/components/ledger/transaction-form";
import { BackLink } from "@/components/back-link";

export const dynamic = "force-dynamic";

export default function NewTransactionPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4">
        <BackLink href="/trades" label="Trades &amp; Purchases" />
      </div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Log a transaction
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Purchase: cards in for cash out. Sale: cards out for cash in.
          Trade: both, with optional cash on either side. Cost basis is
          allocated automatically by market value; you can override per line.
        </p>
      </header>
      <TransactionForm />
    </div>
  );
}
