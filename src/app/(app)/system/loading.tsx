import { Skeleton } from "@/components/ui/skeleton";

// /system runs 11 parallel DB queries to assemble its dashboard. Match
// the section-stack so the page doesn't reflow when data lands.
export default function SystemLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <Skeleton className="h-20 w-full rounded-md" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-40 rounded-sm" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} className="h-16 w-full rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
