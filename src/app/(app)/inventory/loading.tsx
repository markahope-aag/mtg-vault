import { Skeleton } from "@/components/ui/skeleton";

// Layout-matching loading state for /inventory. Reserves header +
// filter bar + table area so the layout doesn't jump.
export default function InventoryLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <Skeleton className="h-24 w-full rounded-md" />
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-[60vh] w-full rounded-md" />
    </div>
  );
}
