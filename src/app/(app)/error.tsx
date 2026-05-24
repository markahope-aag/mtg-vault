"use client";

// Route-segment error boundary for everything under (app). Without
// this, an uncaught Server Component throw falls through to Next's
// default global error UI — a generic black-and-white "Application
// error" page with no styling, no recovery action, and the digest
// hidden behind the framework chrome.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Surface the message in the browser console even in prod builds
    // where Next strips it from the rendered DOM. The digest is the
    // correlation key to grep for in Vercel runtime logs.
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full border border-[var(--value-negative)]/30 bg-[var(--value-negative)]/10 text-[var(--value-negative)]">
        <AlertTriangle className="size-6" />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
        Something went wrong
      </p>
      <h1 className="mt-2 font-[var(--font-display)] text-2xl font-semibold tracking-tight">
        We couldn&rsquo;t render this page
      </h1>
      <p className="mt-3 max-w-prose text-sm text-text-secondary">
        The server hit an unexpected error while loading this view. The
        rest of the app should still work — try refreshing, or head back
        to the dashboard.
      </p>

      {error.digest && (
        <p className="mt-4 font-mono text-[10px] text-text-muted">
          Error reference: <span className="text-text-secondary">{error.digest}</span>
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => unstable_retry()} size="sm">
          <RotateCcw className="size-3.5" /> Try again
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-subtle px-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-inset"
        >
          <ArrowLeft className="size-3.5" /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
