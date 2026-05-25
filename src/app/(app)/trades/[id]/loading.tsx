import { Skeleton } from "@/components/ui/skeleton";

// Transaction detail — header + lines list grouped by direction.
export default function TradeDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6">
      <Skeleton className="h-24 w-full rounded-md" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-32 rounded-sm" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32 rounded-sm" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
