import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ManaCost, ColorIdentityPips } from "@/components/mana-cost";
import { SetSymbol } from "@/components/set-symbol";
import { ValueDelta } from "@/components/value-delta";
import { BracketBadge } from "@/components/bracket-badge";

export const dynamic = "force-dynamic";

const SEMANTIC_TOKENS = [
  { name: "surface-base", varName: "--color-surface-base" },
  { name: "surface-raised", varName: "--color-surface-raised" },
  { name: "surface-overlay", varName: "--color-surface-overlay" },
  { name: "surface-inset", varName: "--color-surface-inset" },
  { name: "border-subtle", varName: "--color-border-subtle" },
  { name: "border-strong", varName: "--color-border-strong" },
  { name: "text-primary", varName: "--color-text-primary" },
  { name: "text-secondary", varName: "--color-text-secondary" },
  { name: "text-muted", varName: "--color-text-muted" },
  { name: "brand", varName: "--color-brand" },
  { name: "brand-strong", varName: "--color-brand-strong" },
  { name: "brand-soft", varName: "--color-brand-soft" },
  { name: "value-positive", varName: "--color-value-positive" },
  { name: "value-negative", varName: "--color-value-negative" },
  { name: "value-neutral", varName: "--color-value-neutral" },
] as const;

const MTG_TOKENS = [
  { name: "mtg-white", varName: "--color-mtg-white" },
  { name: "mtg-blue", varName: "--color-mtg-blue" },
  { name: "mtg-black", varName: "--color-mtg-black" },
  { name: "mtg-red", varName: "--color-mtg-red" },
  { name: "mtg-green", varName: "--color-mtg-green" },
  { name: "mtg-colorless", varName: "--color-mtg-colorless" },
  { name: "mtg-multicolor", varName: "--color-mtg-multicolor" },
] as const;

const BRACKET_TOKENS = [1, 2, 3, 4, 5] as const;
const RARITY_TOKENS = ["common", "uncommon", "rare", "mythic"] as const;
const OWNERSHIP_TOKENS = [
  { name: "owned-available", varName: "--color-owned-available" },
  { name: "owned-committed", varName: "--color-owned-committed" },
  { name: "unowned", varName: "--color-unowned" },
] as const;

const SAMPLE_COSTS = [
  "{W}",
  "{U}",
  "{B}",
  "{R}",
  "{G}",
  "{C}",
  "{2}{W}{U}",
  "{X}{B}{B}",
  "{W/U}{G/W}",
  "{B/P}{B/P}",
  "{T}",
  "{1}{W}{W}{U}{U}",
];

const SAMPLE_SETS: Array<{ code: string; label: string }> = [
  { code: "neo", label: "Kamigawa: Neon Dynasty" },
  { code: "cmr", label: "Commander Legends" },
  { code: "lea", label: "Limited Edition Alpha" },
  { code: "mh3", label: "Modern Horizons 3" },
  { code: "blb", label: "Bloomburrow" },
];

export default function StyleGuide() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
          internal · style guide
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          MTG Vault — Trading Desk
        </h1>
        <p className="max-w-prose text-sm text-text-secondary">
          A single review surface for the design system. Dark is the default;
          toggle via the theme switch in the app header. Every component below
          reads from semantic tokens — no hardcoded colors in component code.
        </p>
      </header>

      <Section title="Typography">
        <div className="space-y-3">
          <Sample label="display / 32 / IBM Plex Sans 600">
            <p className="text-[32px] font-semibold tracking-tight">
              Atraxa, Praetors&rsquo; Voice
            </p>
          </Sample>
          <Sample label="h1 / 24 / 600">
            <p className="text-2xl font-semibold tracking-tight">
              Bracket calculation
            </p>
          </Sample>
          <Sample label="h2 / 18 / 600">
            <p className="text-lg font-semibold">Card detail</p>
          </Sample>
          <Sample label="body / 14 / 400">
            <p className="text-sm leading-relaxed text-text-primary">
              Flying, vigilance, deathtouch, lifelink. At the beginning of your
              end step, proliferate.
            </p>
          </Sample>
          <Sample label="caption / 11 / mono uppercase">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
              acquired · 2025-09-14 · card kingdom
            </p>
          </Sample>
          <Sample label="mono / 13 / tabular numerics">
            <p className="num text-[13px]">
              $1,247.83 &nbsp; +$142.50 &nbsp; vs 30d ago
            </p>
          </Sample>
        </div>
      </Section>

      <Section title="Semantic color tokens">
        <SwatchGrid tokens={SEMANTIC_TOKENS} />
      </Section>

      <Section title="MTG color identity">
        <SwatchGrid tokens={MTG_TOKENS} />
      </Section>

      <Section title="Bracket scale">
        <div className="flex flex-wrap items-center gap-3">
          {BRACKET_TOKENS.map((b) => (
            <div key={b} className="flex flex-col items-center gap-1">
              <BracketBadge bracket={b} showName />
              <code className="font-mono text-[10px] text-text-muted">
                --color-bracket-{b}
              </code>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <BracketBadge bracket={null} prefix="Target" />
            <code className="font-mono text-[10px] text-text-muted">
              null state
            </code>
          </div>
        </div>
      </Section>

      <Section title="Ownership semantics">
        <div className="flex flex-wrap gap-3">
          {OWNERSHIP_TOKENS.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2"
            >
              <span
                className="size-2 rounded-full"
                style={{ background: `var(${t.varName})` }}
              />
              <code className="font-mono text-[11px]">{t.name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Rarity">
        <div className="flex flex-wrap items-center gap-4">
          {RARITY_TOKENS.map((r) => (
            <div key={r} className="flex items-center gap-2">
              <SetSymbol setCode="neo" rarity={r} size="md" />
              <code className="font-mono text-[11px] capitalize text-text-secondary">
                {r}
              </code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Mana cost component">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SAMPLE_COSTS.map((c) => (
            <div
              key={c}
              className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2"
            >
              <ManaCost cost={c} size="md" />
              <code className="font-mono text-[11px] text-text-muted">{c}</code>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
            color identity
          </span>
          <ColorIdentityPips identity={["W", "U", "B", "G"]} size="sm" />
          <ColorIdentityPips identity={["R"]} size="sm" />
          <ColorIdentityPips identity={[]} size="sm" />
        </div>
      </Section>

      <Section title="Set symbols">
        <div className="space-y-2">
          {SAMPLE_SETS.map((s) => (
            <div
              key={s.code}
              className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-raised px-3 py-2"
            >
              <SetSymbol setCode={s.code} rarity="mythic" size="lg" />
              <SetSymbol setCode={s.code} rarity="rare" size="md" />
              <SetSymbol setCode={s.code} rarity="uncommon" size="sm" />
              <SetSymbol setCode={s.code} rarity="common" size="sm" />
              <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
                {s.code}
              </span>
              <span className="text-xs text-text-secondary">{s.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </Section>

      <Section title="Value deltas">
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-border-subtle bg-surface-raised px-4 py-3">
          <ValueDelta value={142.5} />
          <ValueDelta value={-38} />
          <ValueDelta value={0} />
          <ValueDelta value={1247.83} />
          <ValueDelta value={-12.04} precision={2} />
        </div>
      </Section>

      <Section title="Sample data row (the trading-desk feel)">
        <div className="rounded-md border border-border-subtle">
          <div className="grid grid-cols-[40px_2fr_60px_60px_80px_80px_80px] items-center gap-3 border-b border-border-subtle bg-surface-inset px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
            <span></span>
            <span>Card</span>
            <span>Set</span>
            <span>#</span>
            <span className="text-right">USD</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Δ</span>
          </div>
          {[
            {
              name: "Sol Ring",
              cost: null,
              set: "cmr",
              cn: "263",
              usd: 1.43,
              paid: 0.8,
            },
            {
              name: "Cyclonic Rift",
              cost: "{1}{U}",
              set: "rtr",
              cn: "60",
              usd: 22.5,
              paid: 18.0,
            },
            {
              name: "Atraxa, Praetors' Voice",
              cost: "{G}{W}{U}{B}",
              set: "cmr",
              cn: "82",
              usd: 38.9,
              paid: 42.0,
            },
          ].map((row) => (
            <div
              key={row.name}
              className="grid grid-cols-[40px_2fr_60px_60px_80px_80px_80px] items-center gap-3 border-b border-border-subtle px-3 py-1.5 last:border-b-0"
            >
              <span className="size-2 rounded-full bg-[var(--color-owned-available)]" />
              <span className="flex items-center gap-2 text-sm">
                <span className="font-medium">{row.name}</span>
                {row.cost && <ManaCost cost={row.cost} size="xs" />}
              </span>
              <SetSymbol setCode={row.set} rarity="rare" size="sm" />
              <span className="num text-[12px] text-text-muted">{row.cn}</span>
              <span className="num text-right text-[13px]">
                ${row.usd.toFixed(2)}
              </span>
              <span className="num text-right text-[12px] text-text-muted">
                ${row.paid.toFixed(2)}
              </span>
              <span className="text-right">
                <ValueDelta value={row.usd - row.paid} className="text-[12px]" />
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Surfaces">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">surface-raised</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-text-secondary">
                Default card body — most content lives here.
              </p>
            </CardContent>
          </Card>
          <div className="rounded-md border border-border-subtle bg-surface-inset p-4">
            <p className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
              surface-inset
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              For table headers, wells, secondary regions.
            </p>
          </div>
        </div>
      </Section>

      <Section title="States">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-text-muted">
                Empty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary">
                No cards yet. Press ⌘K to search and add your first card.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-text-muted">
                Loading
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-[var(--color-value-negative)]">
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--color-value-negative)]">
                Couldn&rsquo;t reach Commander Spellbook. Bracket estimate may
                be conservative.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Input">
        <div className="space-y-2">
          <Input placeholder="Search cards…" />
          <Input value="$24.50" readOnly className="font-mono" />
          <Input disabled placeholder="Disabled" />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
        {title}
      </h2>
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-5">
        {children}
      </div>
    </section>
  );
}

function Sample({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4 border-b border-border-subtle pb-2 last:border-b-0">
      <code className="w-56 shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-muted">
        {label}
      </code>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SwatchGrid({
  tokens,
}: {
  tokens: ReadonlyArray<{ name: string; varName: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {tokens.map((t) => (
        <div
          key={t.name}
          className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-raised p-2"
        >
          <span
            className="size-8 rounded border border-border-subtle"
            style={{ background: `var(${t.varName})` }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] text-text-primary">
              {t.name}
            </p>
            <p className="truncate font-mono text-[9px] text-text-muted">
              {t.varName}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
