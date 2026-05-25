import { Skeleton } from "@/components/ui/skeleton";

// Log-transaction form — back link + header + kind picker + header
// fields card + columns area + submit band.
export default function NewTransactionLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-6 w-32 rounded-sm" />
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-24 w-full rounded-md" />
      <Skeleton className="h-48 w-full rounded-md" />
      <Skeleton className="h-72 w-full rounded-md" />
      <Skeleton className="h-16 w-full rounded-md" />
    </div>
  );
}
