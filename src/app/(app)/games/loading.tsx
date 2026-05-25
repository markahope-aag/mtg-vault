import { Skeleton } from "@/components/ui/skeleton";

export default function GamesLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-96 w-full rounded-md" />
    </div>
  );
}
