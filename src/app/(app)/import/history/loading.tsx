import { Skeleton } from "@/components/ui/skeleton";

// Import history list — header + ~10 batch rows.
export default function ImportHistoryLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6">
      <Skeleton className="h-20 w-full rounded-md" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
