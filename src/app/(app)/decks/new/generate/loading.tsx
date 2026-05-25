import { Skeleton } from "@/components/ui/skeleton";

// Generate-deck entry form — commander picker + scope/kind/bracket
// pickers + archetype textarea + Generate button.
export default function GenerateEntryLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-6 w-32 rounded-sm" />
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-12 w-full rounded-md" />
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-12 w-32 self-end rounded-md" />
    </div>
  );
}
