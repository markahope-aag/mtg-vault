import { Skeleton } from "@/components/ui/skeleton";

// Admin bracket-flags audit — counts grid + sample card lists.
export default function BracketFlagsAdminLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <Skeleton className="h-20 w-full rounded-md" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-md" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-md" />
      <Skeleton className="h-72 w-full rounded-md" />
    </div>
  );
}
