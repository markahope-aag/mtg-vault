import { Skeleton } from "@/components/ui/skeleton";

// Proposal detail / live generation — back link + header + either the
// progress stream (status updates) or the proposal card list.
export default function ProposalLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-6 w-32 rounded-sm" />
      <Skeleton className="h-24 w-full rounded-md" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-[60vh] w-full rounded-md" />
        <Skeleton className="h-[60vh] w-full rounded-md" />
      </div>
    </div>
  );
}
