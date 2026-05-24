import { Loader2 } from "lucide-react";

// Fallback loading UI for every route under (app). Routes with heavier
// or more recognizable layouts (cards/[oracle_id], and any tailored
// skeletons that follow) provide their own loading.tsx — this is the
// catch-all so a slow server render never shows blank.
export default function AppLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-[50vh] w-full max-w-6xl items-center justify-center px-4 py-10"
    >
      <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Loading…
      </span>
    </div>
  );
}
