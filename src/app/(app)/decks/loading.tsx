import { Skeleton } from "@/components/ui/skeleton";

// Decks list — header band + tab strip + 3-column tile grid.
export default function DecksLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-9 w-64 rounded-md" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
