import { Skeleton } from "@/components/ui/skeleton";

// Deckbuilder shell — three-pane workspace on wide viewports.
export default function DeckDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-4 py-4">
      <Skeleton className="h-12 w-full rounded-md" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_360px]">
        <Skeleton className="h-[70vh] w-full rounded-md" />
        <Skeleton className="h-[70vh] w-full rounded-md" />
        <Skeleton className="h-[70vh] w-full rounded-md" />
      </div>
    </div>
  );
}
