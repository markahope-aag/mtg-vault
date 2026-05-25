import { Skeleton } from "@/components/ui/skeleton";

// /trades — header + ledger list with right-rail summary cards.
export default function TradesLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <Skeleton className="h-20 w-full rounded-md" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
