"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitFork } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Chip = {
  label: string;
  instruction: string;
  // Optional structural overrides — applied when the chip's intent is
  // mechanical (changing target bracket or inventory scope). The API
  // accepts these as top-level fields; the instruction text is still
  // sent so the LLM understands the user-facing framing.
  targetBracket?: number;
  inventoryScope?: "unassigned" | "all_owned" | "ignore";
};

function chipsForBracket(currentTarget: number | null): Chip[] {
  const chips: Chip[] = [];
  // Suggest the two adjacent brackets — that's what users actually iterate
  // toward in practice. Skip self.
  for (const t of [2, 3, 4]) {
    if (t === currentTarget) continue;
    chips.push({
      label: `→ Bracket ${t}`,
      instruction: `Re-target the deck for Bracket ${t}. Adjust the build to match the rules of that bracket (cut Game Changers and fast tutors for lower brackets; add them for higher).`,
      targetBracket: t,
    });
  }
  return chips;
}

const STRATEGY_CHIPS: Chip[] = [
  {
    label: "Stay in my collection",
    instruction:
      "Prefer cards I already own (use the inventory bias list aggressively). Only suggest cards I don't own when nothing in the collection fills the slot.",
    inventoryScope: "unassigned",
  },
  {
    label: "More aggressive",
    instruction:
      "Make this deck more aggressive: lower the average mana value, add more proactive threats, cut a few interaction pieces for tempo.",
  },
  {
    label: "More controlling",
    instruction:
      "Shift this deck toward control: add more interaction (counterspells, removal, board wipes), slow the curve, cut a few proactive threats.",
  },
  {
    label: "Swap wincon",
    instruction:
      "Keep the thesis and support shell, but replace the primary win condition with a different finisher package. Preserve the rest of the build.",
  },
];

export function IteratePanel({
  proposalId,
  currentTarget,
}: {
  proposalId: string;
  currentTarget: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (chip?: Chip) => {
    const finalInstruction = chip?.instruction ?? instruction.trim();
    if (!finalInstruction || finalInstruction.length < 3) {
      toast.error("Tell me what to change.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/iterate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instruction: finalInstruction,
          targetBracket: chip?.targetBracket,
          inventoryScope: chip?.inventoryScope,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast.success("Iterating — opening child proposal.");
      router.push(`/decks/new/generate/${body.id}`);
    } catch (err) {
      toast.error(
        `Iterate failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">
          <GitFork className="mr-1 inline-block size-3.5" />
          Iterate / What-if
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Show"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 p-4 pt-0">
          <p className="text-xs text-text-muted">
            Fork this proposal with one targeted change. The thesis carries
            forward; everything downstream — including the adversarial
            critique — re-runs against the new build.
          </p>

          <div>
            <p className="font-mono text-[10px] uppercase text-text-muted">
              Quick changes
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[...chipsForBracket(currentTarget), ...STRATEGY_CHIPS].map(
                (c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => submit(c)}
                    disabled={submitting}
                    className="rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-[11px] hover:bg-surface-inset disabled:opacity-50"
                  >
                    {c.label}
                  </button>
                ),
              )}
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase text-text-muted">
              Custom instruction
            </p>
            <Textarea
              rows={2}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder='e.g. "Replace blue card draw with green ramp" or "Add a graveyard backup plan"'
              className="mt-1"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => submit()}
              disabled={submitting || instruction.trim().length < 3}
            >
              {submitting ? "Iterating…" : "Iterate"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
