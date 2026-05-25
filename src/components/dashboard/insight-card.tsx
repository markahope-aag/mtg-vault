import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManaCost } from "@/components/mana-cost";
import { cn } from "@/lib/utils";

// Mapping tables for the "By color" insight panel. Kept here (vs the page)
// so the dashboard page doesn't need to know about color tokenization.
export const COLOR_TOKEN: Record<string, string> = {
  W: "var(--color-mtg-white)",
  U: "var(--color-mtg-blue)",
  B: "var(--color-mtg-black)",
  R: "var(--color-mtg-red)",
  G: "var(--color-mtg-green)",
  Colorless: "var(--color-mtg-colorless)",
  Multicolor: "var(--color-mtg-multicolor)",
};

export const COLOR_LABEL: Record<string, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  Colorless: "Colorless",
  Multicolor: "Multicolor",
};

// Maps the distribution key to a mana-cost string so ManaCost renders a
// proper Mana-font glyph next to each row.
export const COLOR_MANA: Record<string, string | null> = {
  W: "{W}",
  U: "{U}",
  B: "{B}",
  R: "{R}",
  G: "{G}",
  Colorless: "{C}",
  Multicolor: null,
};

export function InsightCard({
  title,
  entries,
  getTint,
  relabel,
  getIcon,
  mono,
  defaultTint,
}: {
  title: string;
  entries: Array<{ label: string; count: number }>;
  getTint?: (label: string) => string | undefined;
  relabel?: (label: string) => string;
  getIcon?: (label: string) => string | null;
  mono?: boolean;
  defaultTint?: string;
}) {
  const max = Math.max(1, ...entries.map((e) => e.count));
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardTitle className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-3 pb-3">
        {entries.length === 0 ? (
          <p className="empty-terminal">no data</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.slice(0, 7).map((e) => {
              // Fall back to defaultTint, then the MTG-white token, so
              // untinted charts read as crisp colored bars instead of muted
              // gray. Per-row tints (getTint) still win when provided.
              const tint =
                getTint?.(e.label) ?? defaultTint ?? "var(--color-mtg-white)";
              const width = Math.max(2, Math.round((e.count / max) * 100));
              const mana = getIcon?.(e.label) ?? null;
              return (
                <li key={e.label} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {mana ? (
                        <ManaCost cost={mana} size="xs" />
                      ) : (
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: tint }}
                        />
                      )}
                      <span
                        className={cn(
                          "truncate",
                          mono &&
                            "font-mono uppercase tracking-wide text-text-secondary",
                        )}
                      >
                        {relabel ? relabel(e.label) : e.label}
                      </span>
                    </span>
                    <span className="num shrink-0 text-text-muted">
                      {e.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--surface-inset)]/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${width}%`,
                        background: tint,
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
