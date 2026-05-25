import { Skeleton } from "@/components/ui/skeleton";

// /market — sources strip + bargains card + three valuation lists.
export default function MarketLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-48 w-full rounded-md" />
      <Skeleton className="h-72 w-full rounded-md" />
      <Skeleton className="h-72 w-full rounded-md" />
      <Skeleton className="h-72 w-full rounded-md" />
    </div>
  );
}
