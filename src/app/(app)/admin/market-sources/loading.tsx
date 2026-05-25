import { Skeleton } from "@/components/ui/skeleton";

// Admin market-sources — back link + header + add-source form +
// source rows.
export default function MarketSourcesAdminLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-6 w-32 rounded-sm" />
      <Skeleton className="h-20 w-full rounded-md" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
