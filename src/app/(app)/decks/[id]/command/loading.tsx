import { Skeleton } from "@/components/ui/skeleton";

export default function CommandLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-5 w-24 rounded-sm" />
      <Skeleton className="h-20 w-full rounded-md" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-60 rounded-md" />
        <Skeleton className="h-60 rounded-md" />
        <Skeleton className="h-60 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-60 rounded-md" />
        <Skeleton className="h-60 rounded-md" />
        <Skeleton className="h-60 rounded-md" />
      </div>
    </div>
  );
}
