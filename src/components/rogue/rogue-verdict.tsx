import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type RogueRationale = {
  consensusBuild: string;
  departure: string;
  powerThesis: string;
  unusualnessScore: number;
};

export type RogueCritique = {
  counterarguments: string[];
  premortemFailures: string[];
  tradeVerdict: string;
  confidence: "speculative" | "promising" | "questionable" | "likely_flawed";
  confidenceCaveat: string;
};

// Confidence is presented with equal visual weight to the power thesis, NOT
// buried as a footnote. A talked-down rogue verdict is the system working —
// the UI shouldn't treat it as embarrassing.
const CONFIDENCE_TONE: Record<RogueCritique["confidence"], string> = {
  promising:
    "border-[var(--value-positive)]/60 bg-[var(--value-positive)]/10 text-[var(--value-positive)]",
  speculative: "border-amber-500/60 bg-amber-500/10 text-amber-500",
  questionable:
    "border-[var(--color-bracket-3)]/60 bg-[var(--color-bracket-3)]/10 text-[var(--color-bracket-3)]",
  likely_flawed:
    "border-[var(--value-negative)]/60 bg-[var(--value-negative)]/10 text-[var(--value-negative)]",
};

const CONFIDENCE_LABEL: Record<RogueCritique["confidence"], string> = {
  promising: "Promising",
  speculative: "Speculative",
  questionable: "Questionable",
  likely_flawed: "Likely flawed",
};

export function RogueVerdict({
  rationale,
  critique,
}: {
  rationale: RogueRationale;
  critique: RogueCritique;
}) {
  return (
    <div className="space-y-4">
      {/* Top-line verdict — prominent, can be negative without apology. */}
      <Card
        className={cn("border-2", CONFIDENCE_TONE[critique.confidence])}
      >
        <CardContent className="space-y-2 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em]">
              Calibrated verdict
            </p>
            <span className="font-mono text-xs uppercase tracking-wide">
              Unusualness {rationale.unusualnessScore}/10
            </span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">
            {CONFIDENCE_LABEL[critique.confidence]}
          </p>
          <p className="text-sm">{critique.confidenceCaveat}</p>
        </CardContent>
      </Card>

      {/* Power thesis + counter-attack side-by-side, equal weight. The
          caveat above already framed the tension; this is the detail. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Power thesis (the author&rsquo;s argument)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                Consensus build
              </p>
              <p className="text-text-secondary">{rationale.consensusBuild}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                Departure
              </p>
              <p>{rationale.departure}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                Why it could work
              </p>
              <p>{rationale.powerThesis}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Critique (independent evaluation)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                Strongest counterarguments
              </p>
              <ul className="ml-3 list-disc space-y-0.5">
                {critique.counterarguments.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                Premortem failure modes
              </p>
              <ul className="ml-3 list-disc space-y-0.5">
                {critique.premortemFailures.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                Vs the consensus build
              </p>
              <p>{critique.tradeVerdict}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
