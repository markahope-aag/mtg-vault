import { Skeleton } from "@/components/ui/skeleton";

// Layout-matching loading state for /dashboard. The actual page is a
// hero band + value chart + decks/insights split + top-20 grid; this
// reserves the same vertical real estate so the layout doesn't jump
// once data lands.
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-64 w-full rounded-md" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-80 w-full rounded-md" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
      <Skeleton className="h-96 w-full rounded-md" />
    </div>
  );
}
