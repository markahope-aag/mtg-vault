import { Skeleton } from "@/components/ui/skeleton";

// Import wizard — header + step body (~3xl container).
export default function ImportLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <Skeleton className="h-24 w-full rounded-md" />
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-72 w-full rounded-md" />
      </div>
    </div>
  );
}
