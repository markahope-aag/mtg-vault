"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

const PASS_LABEL: Record<string, string> = {
  pick_commander: "Picking commander",
  pass1_generate: "Drafting the deck (Pass 1)",
  pass2_validate: "Validating (Pass 2)",
  pass3_repair: "Repairing violations (Pass 3)",
  pass4_manabase: "Computing manabase (Pass 4)",
  pass5_analyze: "Final analysis (Pass 5)",
};

const PASS_ORDER = [
  "pick_commander",
  "pass1_generate",
  "pass2_validate",
  "pass3_repair",
  "pass4_manabase",
  "pass5_analyze",
];

export function GenerationProgress({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [latestPass, setLatestPass] = useState<string | null>(null);
  const [passes, setPasses] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/proposals/${proposalId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        const p = body.proposal as {
          status: string;
          generationLog: { passes?: Array<{ name: string }> } | null;
        };
        const passNames = (p.generationLog?.passes ?? []).map((x) => x.name);
        setPasses(passNames);
        setLatestPass(passNames[passNames.length - 1] ?? null);
        if (p.status === "ready" || p.status === "saved") {
          // Hand off to the proposal view (server component re-renders).
          router.refresh();
          return;
        }
        if (p.status === "failed") {
          setError("Generation failed — see the server logs.");
          return;
        }
      } catch (err) {
        if (cancelled) return;
        toast.error(
          `Status poll failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (!cancelled) timer = window.setTimeout(poll, 2500);
    }
    void poll();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [proposalId, router]);

  if (error) {
    return (
      <Card className="border-[var(--value-negative)]/40 bg-[var(--value-negative)]/10">
        <CardContent className="p-6 text-sm">
          <p className="font-medium text-[var(--value-negative)]">
            Generation failed
          </p>
          <p className="mt-1 text-text-secondary">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          <span className="font-medium">
            {PASS_LABEL[latestPass ?? "pass1_generate"] ?? "Working…"}
          </span>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          This usually takes 30-90 seconds. Five passes run in sequence: pick
          (if no commander given), generate, validate, repair (up to 3 times),
          manabase, analyze.
        </p>
        <ul className="mt-4 space-y-1.5 text-xs">
          {PASS_ORDER.map((p) => {
            const done = passes.includes(p);
            const current = latestPass === p;
            return (
              <li
                key={p}
                className={`flex items-center gap-2 ${done && !current ? "text-text-muted" : ""}`}
              >
                <span
                  className={`inline-block size-1.5 rounded-full ${
                    done && !current
                      ? "bg-[var(--value-positive)]"
                      : current
                        ? "animate-pulse bg-[var(--brand)]"
                        : "bg-text-muted/40"
                  }`}
                />
                <span>{PASS_LABEL[p]}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
