"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { cn } from "@/lib/utils";

export type BuilderProposal = {
  id: string;
  kind: string;
  status: "generating" | "ready" | "failed" | "saved";
  targetBracket: number | null;
  archetypeBrief: string | null;
  commanderOracleId: string | null;
  commanderName: string | null;
  commanderImageUri: string | null;
  createdAt: string;
  cardCount: number;
};

// Status tone matches the user's mental model:
//   generating → live signal (brand)
//   ready → green (use the build)
//   failed → red (look at the log)
//   saved → muted (this proposal already committed and exits Builder)
const STATUS_TONE: Record<BuilderProposal["status"], string> = {
  generating:
    "border-[var(--brand)]/40 bg-[var(--color-brand-soft)]/30 text-[var(--brand)]",
  ready:
    "border-[var(--value-positive)]/40 bg-[var(--value-positive)]/10 text-[var(--value-positive)]",
  failed:
    "border-[var(--value-negative)]/40 bg-[var(--value-negative)]/10 text-[var(--value-negative)]",
  saved: "border-border-subtle bg-surface-inset/40 text-text-muted",
};

const STATUS_LABEL: Record<BuilderProposal["status"], string> = {
  generating: "Generating",
  ready: "Ready to review",
  failed: "Failed",
  saved: "Saved",
};

export function BuilderList({ proposals }: { proposals: BuilderProposal[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  const onDelete = useCallback(
    (p: BuilderProposal) => {
      confirmToast(
        `Delete the ${p.kind} proposal for ${p.commanderName ?? "(unknown commander)"}?`,
        {
          description:
            "This removes the draft + its analysis + the generation log. If the proposal was already saved as a real deck, the deck itself is untouched.",
          onConfirm: async () => {
            setDeleting(p.id);
            try {
              const res = await fetch(`/api/proposals/${p.id}`, {
                method: "DELETE",
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              toast.success("Proposal deleted");
              router.refresh();
            } catch (err) {
              toast.error(
                `Couldn't delete: ${err instanceof Error ? err.message : String(err)}`,
              );
            } finally {
              setDeleting(null);
            }
          },
        },
      );
    },
    [router],
  );

  if (proposals.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 p-12 text-center">
        <p className="empty-terminal">no drafts in flight</p>
        <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
          Generated proposals land here until you save them as a real deck or
          delete them.
        </p>
        <Link
          href="/decks/new/generate"
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 text-xs font-medium text-[var(--brand-foreground)] hover:bg-[var(--brand)]/90"
        >
          <Sparkles className="size-3.5" /> Generate one
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {proposals.map((p) => (
        <li
          key={p.id}
          className="flex flex-wrap items-center gap-3 rounded-md border border-border-subtle bg-surface-raised p-3"
        >
          <ImgWithFallback
            src={p.commanderImageUri}
            alt={p.commanderName ?? "Proposal"}
            className="size-12 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
            fallbackClassName="flex size-12 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
            fallbackIconClassName="size-4"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <Link
                href={`/decks/new/generate/${p.id}`}
                className="truncate text-sm font-medium hover:underline"
              >
                {p.commanderName ?? "(commander not yet picked)"}
              </Link>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide",
                  STATUS_TONE[p.status],
                )}
              >
                {p.status === "generating" && (
                  <Loader2 className="size-3 animate-spin" />
                )}
                {STATUS_LABEL[p.status]}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                {p.kind} · B{p.targetBracket ?? "?"} · {p.cardCount} cards
              </span>
            </div>
            {p.archetypeBrief && (
              <p className="mt-1 truncate text-xs text-text-muted">
                {p.archetypeBrief}
              </p>
            )}
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
              {new Date(p.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/decks/new/generate/${p.id}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-inset px-2.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary hover:border-border-strong hover:text-text-primary"
            >
              Open
            </Link>
            <button
              type="button"
              onClick={() => onDelete(p)}
              disabled={deleting === p.id}
              className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-inset hover:text-[var(--value-negative)] disabled:opacity-50"
              aria-label="Delete proposal"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
