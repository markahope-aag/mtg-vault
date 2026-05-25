import { Skeleton } from "@/components/ui/skeleton";

export default function NewGameLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-5 w-24 rounded-sm" />
      <Skeleton className="h-12 w-64 rounded-md" />
      <Skeleton className="h-44 w-full rounded-md" />
      <Skeleton className="h-40 w-full rounded-md" />
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-12 w-full rounded-md" />
    </div>
  );
}
