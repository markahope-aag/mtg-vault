import { ArrowDown, ArrowUp, Check, ImageOff, Loader2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ManaCost } from "@/components/mana-cost";
import { SetSymbol } from "@/components/set-symbol";

export const dynamic = "force-dynamic";

export default function StyleGuide() {
  return (
    <main className="bg-[var(--surface-base)] text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <Header />
        <div className="mt-8 space-y-12">
          <SurfaceElevation />
          <Typography />
          <Numerics />
          <PageTemplates />
          <Accent />
          <Deltas />
          <StatCards />
          <Brackets />
          <Ownership />
          <Rarity />
          <Mana />
          <Sets />
          <Buttons />
          <States />
          <ThemeComparison />
        </div>
        <footer className="mt-16 border-t border-[var(--border-subtle)] pt-4 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          mtg vault · style guide · internal
        </footer>
      </div>
    </main>
  );
}

/* ────────────────────────── Header ────────────────────────── */

function Header() {
  return (
    <header className="space-y-3 border-b border-[var(--border-subtle)] pb-6">
      <div className="flex items-baseline gap-3">
        <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.32em] text-[var(--brand)]">
          {"// style guide"}
        </span>
        <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          v0 · dark default
        </span>
      </div>
      <h1 className="font-[var(--font-display)] text-[44px] font-semibold leading-[1.05] tracking-tight">
        Trading Desk
      </h1>
      <p className="max-w-prose text-[15px] leading-relaxed text-[var(--text-secondary)]">
        The design system for MTG Vault. Dark first, surface elevation by
        contrast, monospace numerics everywhere they matter, a single amber
        accent. Every color below comes from a semantic token — components
        never reach for raw hex.
      </p>
    </header>
  );
}

/* ────────────────────────── Section primitive ────────────────────────── */

function Section({
  label,
  title,
  desc,
  children,
}: {
  label: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.24em] text-[var(--brand)]">
          {label}
        </p>
        <h2 className="font-[var(--font-display)] text-[22px] font-semibold tracking-tight">
          {title}
        </h2>
        {desc && (
          <p className="max-w-prose text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {desc}
          </p>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

/* ────────────────────────── Surface elevation ────────────────────────── */

function SurfaceElevation() {
  return (
    <Section
      label="01 — Foundations"
      title="Surface elevation"
      desc="Panels are visibly lighter than the background. Hairlines exist but never carry elevation alone."
    >
      <div className="relative overflow-hidden rounded-md bg-[var(--surface-base)] p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {[
            {
              token: "--surface-inset",
              bg: "bg-[var(--surface-inset)]",
              use: "Wells, table headers, sub-regions inside a card",
            },
            {
              token: "--surface-base",
              bg: "bg-[var(--surface-base)]",
              use: "Page background — the deepest plane",
            },
            {
              token: "--surface-raised",
              bg: "bg-[var(--surface-raised)]",
              use: "Cards, panels, list items — sits visibly on top of base",
            },
            {
              token: "--surface-overlay",
              bg: "bg-[var(--surface-overlay)]",
              use: "Modals, popovers, drawers — floats over content",
            },
          ].map((s) => (
            <div key={s.token} className="flex flex-col gap-2">
              <div
                className={`${s.bg} flex h-32 items-end rounded-md p-3 ring-1 ring-[var(--border-subtle)]`}
              >
                <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {s.token}
                </span>
              </div>
              <p className="text-[12px] leading-snug text-[var(--text-secondary)]">
                {s.use}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-md bg-[var(--surface-raised)] p-4 ring-1 ring-[var(--border-subtle)]">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            stacked
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            When a panel sits inside another, the inner surface goes one step
            higher (here: <code className="text-[var(--brand)]">raised</code>{" "}
            on <code className="text-[var(--brand)]">base</code>). Avoid
            adjacent elements on the same surface level.
          </p>
          <div className="mt-3 rounded-md bg-[var(--surface-overlay)] p-3 ring-1 ring-[var(--border-subtle)]">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              overlay on raised on base
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Three distinct layers, clearly readable without borders doing the
              work.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ────────────────────────── Typography ────────────────────────── */

function Typography() {
  return (
    <Section
      label="02 — Type"
      title="Three faces, three jobs"
      desc="Space Grotesk for display. Inter for body. JetBrains Mono for every number. No serif anywhere."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Specimen
          label="Display · Space Grotesk · 44/600"
          font="font-[var(--font-display)]"
        >
          <p className="text-[44px] font-semibold leading-none tracking-tight">
            Atraxa, Praetors&rsquo; Voice
          </p>
          <p className="text-[28px] font-semibold leading-tight tracking-tight">
            Calculated bracket
          </p>
          <p className="text-[20px] font-semibold leading-snug tracking-tight">
            Recently disposed
          </p>
        </Specimen>
        <Specimen
          label="Body · Inter · 14/400"
          font="font-[var(--font-body)]"
        >
          <p className="text-[15px] leading-relaxed text-[var(--text-primary)]">
            Flying, vigilance, deathtouch, lifelink. At the beginning of your
            end step, proliferate.
          </p>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Acquired from Card Kingdom on 2025-09-14. Stored in Long box 1
            alongside the rest of the Atraxa shell.
          </p>
          <p className="text-[12px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Legendary Creature — Phyrexian Angel Horror
          </p>
        </Specimen>
        <Specimen
          label="Mono · JetBrains Mono · tabular"
          font="font-[var(--font-mono)]"
          full
        >
          <p className="num text-[44px] font-semibold leading-none">
            $1,247.83
          </p>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[15px]">
            <span className="num text-[var(--value-positive)]">
              ▲ +$142.50
            </span>
            <span className="num text-[var(--value-positive)]">+12.95%</span>
            <span className="num text-[var(--text-muted)]">vs 30d ago</span>
          </div>
          <table className="num w-full text-[13px]">
            <tbody>
              <tr>
                <td className="py-0.5 text-[var(--text-muted)]">qty</td>
                <td className="py-0.5 text-right">47</td>
                <td className="py-0.5 pl-6 text-[var(--text-muted)]">unique</td>
                <td className="py-0.5 text-right">32</td>
              </tr>
              <tr>
                <td className="py-0.5 text-[var(--text-muted)]">foil</td>
                <td className="py-0.5 text-right">4</td>
                <td className="py-0.5 pl-6 text-[var(--text-muted)]">cost</td>
                <td className="py-0.5 text-right">$1,105.33</td>
              </tr>
              <tr>
                <td className="py-0.5 text-[var(--text-muted)]">bracket</td>
                <td className="py-0.5 text-right text-[var(--bracket-3)]">
                  B3
                </td>
                <td className="py-0.5 pl-6 text-[var(--text-muted)]">target</td>
                <td className="py-0.5 text-right text-[var(--bracket-2)]">
                  B2
                </td>
              </tr>
            </tbody>
          </table>
        </Specimen>
      </div>
    </Section>
  );
}

function Specimen({
  label,
  font,
  full,
  children,
}: {
  label: string;
  font: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${full ? "lg:col-span-2" : ""} rounded-md bg-[var(--surface-raised)] p-5`}
    >
      <p className="mb-4 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </p>
      <div className={`${font} space-y-3`}>{children}</div>
    </div>
  );
}

/* ────────────────────────── Numerics ────────────────────────── */

function Numerics() {
  return (
    <Section
      label="03 — Numerics rule"
      title="Every number is mono"
      desc="Prices, counts, percentages, bracket numbers, dates, deltas, IDs. Apply via the .num utility (mono + tabular-nums)."
    >
      <div className="overflow-hidden rounded-md bg-[var(--surface-raised)]">
        <div className="grid grid-cols-2 divide-y divide-[var(--border-subtle)] lg:grid-cols-4 lg:divide-y-0 lg:divide-x">
          {[
            { label: "Cards", value: "1,247", sub: "32 unique" },
            { label: "Market value", value: "$48,290.12", sub: "+$142.50" },
            { label: "Bracket", value: "B3", sub: "target B2" },
            { label: "Cost basis", value: "$36,104.50", sub: "+33.7%" },
          ].map((s) => (
            <div key={s.label} className="space-y-2 p-5">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {s.label}
              </p>
              <p className="num text-[28px] font-semibold leading-none text-[var(--text-primary)]">
                {s.value}
              </p>
              <p className="num text-[12px] text-[var(--text-secondary)]">
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ────────────────────────── Page templates ────────────────────────── */

function PageTemplates() {
  return (
    <Section
      label="03b — Page templates"
      title="Every page uses the same headers"
      desc="Three header levels, used consistently. Page header opens the route. Section header divides major regions. Card header tops every Card primitive. Table header lives at column row 1. Sizes and weights are FIXED — never invent new ones on a per-page basis."
    >
      <div className="space-y-3">
        {/* PAGE HEADER */}
        <Template
          name="Page header"
          rule="44px display semibold · 10px mono uppercase eyebrow · 14px secondary subtitle"
        >
          <div className="space-y-2">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Dashboard
            </p>
            <h1 className="font-[var(--font-display)] text-[44px] font-semibold leading-[1.05] tracking-tight">
              Collection snapshot
            </h1>
            <p className="max-w-prose text-[14px] text-[var(--text-secondary)]">
              What you own, what it&rsquo;s worth, what your decks are doing
              right now.
            </p>
          </div>
        </Template>

        {/* SECTION HEADER */}
        <Template
          name="Section header"
          rule="22px display semibold · 10px mono uppercase eyebrow · 13px secondary subtitle (optional)"
        >
          <div className="space-y-1">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--brand)]">
              07 — Brackets
            </p>
            <h2 className="font-[var(--font-display)] text-[22px] font-semibold tracking-tight">
              Power scale 1 – 5
            </h2>
            <p className="max-w-prose text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Each bracket carries its own color token, used consistently
              across the app.
            </p>
          </div>
        </Template>

        {/* CARD HEADER */}
        <Template
          name="Card header"
          rule="10px mono uppercase tracked label · optional right-aligned action"
        >
          <div className="rounded-md bg-[var(--surface-raised)] p-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
              <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                Value over time
              </p>
              <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                90d · 30 points
              </span>
            </div>
            <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
              Card body sits below the header with consistent border-divider
              spacing.
            </p>
          </div>
        </Template>

        {/* TABLE HEADER */}
        <Template
          name="Table header"
          rule="10px mono uppercase 0.16em tracked · surface-inset background · 6px vertical pad"
        >
          <div className="overflow-hidden rounded-md bg-[var(--surface-raised)]">
            <table className="w-full text-[13px]">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-inset)] font-[var(--font-mono)] text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-1.5 text-left">Card</th>
                  <th className="w-16 px-2 py-1.5 text-left">Set</th>
                  <th className="w-14 px-2 py-1.5 text-left">#</th>
                  <th className="w-20 px-2 py-1.5 text-right">USD</th>
                  <th className="w-20 px-2 py-1.5 text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border-subtle)] last:border-b-0">
                  <td className="px-3 py-1.5 font-medium text-[var(--text-primary)]">
                    Sol Ring
                  </td>
                  <td className="px-2 py-1.5 font-[var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                    CMR
                  </td>
                  <td className="num px-2 py-1.5 text-[11px] text-[var(--text-muted)]">
                    263
                  </td>
                  <td className="num px-2 py-1.5 text-right text-[var(--text-primary)]">
                    $1.43
                  </td>
                  <td className="num px-2 py-1.5 text-right text-[var(--text-muted)]">
                    $0.80
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Template>

        {/* SUB-SECTION HEADER */}
        <Template
          name="Sub-section header"
          rule="10px mono uppercase 0.18em tracked · used inside a Card to label a sub-region (e.g. metrics chip row, ledger)"
        >
          <div className="rounded-md bg-[var(--surface-raised)] p-4">
            <p className="mb-2 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Metrics
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["GC 0", "2-card combo 0", "MLD 0", "Tutors 0"].map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-1.5 py-0.5 font-[var(--font-mono)] text-[10px] uppercase tracking-wide text-[var(--text-muted)]"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </Template>

        {/* PAGE LAYOUT */}
        <Template
          name="Page layout"
          rule="max-w-6xl · px-4 · py-6 · between-section spacing space-y-12 (Dashboard) or space-y-5 (data-dense like Inventory / Deckbuilder)"
        >
          <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--surface-inset)]/60 p-4">
            <pre className="overflow-x-auto font-[var(--font-mono)] text-[11px] leading-relaxed text-[var(--text-secondary)]">{`<main className="bg-[var(--surface-base)]">
  <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-5">
    {/* page header */}
    {/* sections */}
  </div>
</main>`}</pre>
          </div>
        </Template>
      </div>
    </Section>
  );
}

function Template({
  name,
  rule,
  children,
}: {
  name: string;
  rule: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)]">
      <div className="flex items-baseline gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-2">
        <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--brand)]">
          {name}
        </span>
        <span className="font-[var(--font-mono)] text-[10px] text-[var(--text-muted)]">
          {rule}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ────────────────────────── Accent ────────────────────────── */

function Accent() {
  return (
    <Section
      label="04 — Accent"
      title="Amber gold — one accent, used sparingly"
      desc="Primary actions, active nav, focus states, key data highlights. Never decorative."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md bg-[var(--surface-raised)] p-5">
          <p className="mb-3 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            primary action
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--brand)] px-4 font-[var(--font-display)] text-[13px] font-semibold text-[var(--brand-fg)] shadow-[inset_0_-1px_0_0_oklch(0_0_0_/_0.15)] transition-colors hover:bg-[var(--brand-strong)]">
              <Plus className="size-4" /> New deck
            </button>
            <button className="inline-flex h-9 items-center rounded-md bg-[var(--brand)] px-4 font-[var(--font-display)] text-[13px] font-semibold text-[var(--brand-fg)] opacity-50">
              Disabled
            </button>
          </div>
        </div>
        <div className="rounded-md bg-[var(--surface-raised)] p-5">
          <p className="mb-3 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            active state
          </p>
          <nav className="flex items-center gap-1 text-[13px]">
            <a className="rounded-md px-3 py-1.5 font-medium text-[var(--brand)] ring-1 ring-[var(--brand)]/30 bg-[var(--brand-soft)]/40">
              Dashboard
            </a>
            <a className="rounded-md px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Inventory
            </a>
            <a className="rounded-md px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Decks
            </a>
          </nav>
        </div>
        <div className="rounded-md bg-[var(--surface-raised)] p-5">
          <p className="mb-3 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            focus ring
          </p>
          <input
            placeholder="Tab to here to see the focus ring"
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
          />
        </div>
        <div className="rounded-md bg-[var(--surface-raised)] p-5">
          <p className="mb-3 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            data highlight
          </p>
          <p className="num text-[13px] text-[var(--text-secondary)]">
            Most valuable card:{" "}
            <span className="font-[var(--font-display)] text-[var(--brand)]">
              The Tabernacle at Pendrell Vale
            </span>{" "}
            · <span className="text-[var(--text-primary)]">$4,200.00</span>
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { name: "--brand", token: "var(--brand)" },
          { name: "--brand-strong", token: "var(--brand-strong)" },
          { name: "--brand-soft", token: "var(--brand-soft)" },
        ].map((s) => (
          <div
            key={s.name}
            className="flex items-center gap-3 rounded-md bg-[var(--surface-raised)] p-3"
          >
            <span
              className="h-10 w-14 rounded-sm ring-1 ring-[var(--border-subtle)]"
              style={{ background: s.token }}
            />
            <span className="font-[var(--font-mono)] text-[11px] text-[var(--text-secondary)]">
              {s.name}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ────────────────────────── Deltas ────────────────────────── */

function Deltas() {
  return (
    <Section
      label="05 — Value semantics"
      title="Green up, red down — financial convention"
      desc="Every gain/loss carries a directional arrow and the appropriate token color. Even neutral $0 gets dignified treatment."
    >
      <div className="grid gap-2 lg:grid-cols-3">
        {[
          { value: "+$142.50", pct: "+12.95%", dir: "up" as const },
          { value: "−$38.20", pct: "−2.45%", dir: "down" as const },
          { value: "$0.00", pct: "0.00%", dir: "flat" as const },
        ].map((d, i) => (
          <div
            key={i}
            className="rounded-md bg-[var(--surface-raised)] p-5 ring-1 ring-[var(--border-subtle)]"
          >
            <p className="mb-2 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              30-day delta
            </p>
            <p
              className={`num flex items-center gap-2 text-[24px] font-semibold leading-none ${
                d.dir === "up"
                  ? "text-[var(--value-positive)]"
                  : d.dir === "down"
                    ? "text-[var(--value-negative)]"
                    : "text-[var(--text-muted)]"
              }`}
            >
              {d.dir === "up" && <ArrowUp className="size-4" />}
              {d.dir === "down" && <ArrowDown className="size-4" />}
              {d.dir === "flat" && (
                <span className="inline-block size-3 border-b-2 border-current opacity-60" />
              )}
              {d.value}
            </p>
            <p
              className={`num mt-1 text-[12px] ${
                d.dir === "up"
                  ? "text-[var(--value-positive)]"
                  : d.dir === "down"
                    ? "text-[var(--value-negative)]"
                    : "text-[var(--text-muted)]"
              }`}
            >
              {d.pct}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ────────────────────────── Stat cards ────────────────────────── */

function StatCards() {
  return (
    <Section
      label="06 — Stat cards"
      title="Hierarchy via weight and size"
      desc="Collection Value is the hero. The other three stats are clearly secondary. Identical chrome with intentional weight differences."
    >
      <div className="grid gap-3 lg:grid-cols-4">
        <Stat
          label="Collection value"
          value="$48,290.12"
          subline={
            <span className="num text-[var(--value-positive)]">
              ▲ +$142.50 · +0.30% vs 30d
            </span>
          }
          hero
        />
        <Stat
          label="Cost basis"
          value="$36,104.50"
          subline={
            <span className="num text-[var(--value-positive)]">
              +$12,185.62 unrealized
            </span>
          }
        />
        <Stat
          label="Cards"
          value="1,247"
          subline={
            <span className="num text-[var(--text-muted)]">
              32 unique · 4 foil
            </span>
          }
        />
        <Stat
          label="Realized"
          value="+$284.30"
          subline={
            <span className="num text-[var(--text-muted)]">
              7 disposals · ytd
            </span>
          }
          positive
        />
      </div>
    </Section>
  );
}

function Stat({
  label,
  value,
  subline,
  hero,
  positive,
}: {
  label: string;
  value: string;
  subline: React.ReactNode;
  hero?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-md p-5 ring-1 ring-[var(--border-subtle)] ${hero ? "bg-[var(--surface-raised)] shadow-lg shadow-black/20" : "bg-[var(--surface-raised)]"}`}
    >
      <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={`num font-semibold leading-none ${hero ? "text-[34px] text-[var(--text-primary)]" : "text-[22px] text-[var(--text-primary)]"} ${positive ? "text-[var(--value-positive)]" : ""}`}
      >
        {value}
      </p>
      <p className="text-[11px]">{subline}</p>
    </div>
  );
}

/* ────────────────────────── Brackets ────────────────────────── */

function Brackets() {
  return (
    <Section
      label="07 — Brackets"
      title="Power scale 1 – 5"
      desc="Each bracket carries its own color token, used consistently in badges, history charts, and to-reach diff borders."
    >
      <div className="rounded-md bg-[var(--surface-raised)] p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {[
            { n: 1, name: "Exhibition" },
            { n: 2, name: "Core" },
            { n: 3, name: "Upgraded" },
            { n: 4, name: "Optimized" },
            { n: 5, name: "cEDH" },
          ].map((b) => (
            <div
              key={b.n}
              className="rounded-md border p-4"
              style={{
                background: `color-mix(in oklch, var(--bracket-${b.n}) 12%, var(--surface-raised))`,
                borderColor: `color-mix(in oklch, var(--bracket-${b.n}) 35%, transparent)`,
              }}
            >
              <p
                className="num text-[32px] font-semibold leading-none"
                style={{ color: `var(--bracket-${b.n})` }}
              >
                B{b.n}
              </p>
              <p
                className="mt-1 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em]"
                style={{ color: `var(--bracket-${b.n})` }}
              >
                {b.name}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            badge form
          </span>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className="num inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                color: `var(--bracket-${n})`,
                background: `color-mix(in oklch, var(--bracket-${n}) 15%, transparent)`,
                borderColor: `color-mix(in oklch, var(--bracket-${n}) 35%, transparent)`,
              }}
            >
              B{n}
            </span>
          ))}
          <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            · null state
          </span>
          <span className="num inline-flex items-center rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            target —
          </span>
        </div>
      </div>
    </Section>
  );
}

/* ────────────────────────── Ownership ────────────────────────── */

function Ownership() {
  return (
    <Section
      label="08 — Ownership"
      title="At-a-glance availability"
      desc="A 6px dot tells you instantly whether a card is owned, owned-but-committed, or unowned. Used on every card row across the app."
    >
      <div className="overflow-hidden rounded-md bg-[var(--surface-raised)]">
        <ul className="divide-y divide-[var(--border-subtle)]">
          {[
            {
              dot: "owned-available",
              name: "Sol Ring",
              status: "owned · 2 available",
            },
            {
              dot: "owned-committed",
              name: "Cyclonic Rift",
              status: "owned · committed to Atraxa",
            },
            {
              dot: "unowned",
              name: "The Tabernacle at Pendrell Vale",
              status: "not owned",
            },
          ].map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: `var(--color-${r.dot})` }}
              />
              <span className="flex-1 text-[14px] text-[var(--text-primary)]">
                {r.name}
              </span>
              <span className="num text-[11px] text-[var(--text-muted)]">
                {r.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ────────────────────────── Rarity ────────────────────────── */

function Rarity() {
  return (
    <Section
      label="09 — Rarity"
      title="Tier coloring on set symbols"
      desc="Keyrune sets carry rarity tint automatically. The token system defines the four standard tiers."
    >
      <div className="rounded-md bg-[var(--surface-raised)] p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {(["common", "uncommon", "rare", "mythic"] as const).map((r) => (
            <div key={r} className="flex items-center gap-2">
              <SetSymbol setCode="neo" rarity={r} size="lg" />
              <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                {r}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ────────────────────────── Mana ────────────────────────── */

function Mana() {
  return (
    <Section
      label="10 — Mana"
      title="Real MTG cost symbols"
      desc="Mana font rendering for every cost in the app. Not text, not colored circles — the canonical pips."
    >
      <div className="space-y-3 rounded-md bg-[var(--surface-raised)] p-5">
        <Row label="mono color">
          {["{W}", "{U}", "{B}", "{R}", "{G}", "{C}"].map((c) => (
            <ManaCost key={c} cost={c} size="md" />
          ))}
        </Row>
        <Row label="generic + X">
          {["{2}{W}{U}", "{X}{B}{B}", "{1}{W}{W}{U}{U}"].map((c) => (
            <span key={c} className="inline-flex items-center gap-3">
              <ManaCost cost={c} size="md" />
              <code className="font-[var(--font-mono)] text-[10px] text-[var(--text-muted)]">
                {c}
              </code>
            </span>
          ))}
        </Row>
        <Row label="hybrid + phyrexian">
          {["{W/U}{G/W}", "{B/P}{B/P}"].map((c) => (
            <span key={c} className="inline-flex items-center gap-3">
              <ManaCost cost={c} size="md" />
              <code className="font-[var(--font-mono)] text-[10px] text-[var(--text-muted)]">
                {c}
              </code>
            </span>
          ))}
        </Row>
        <Row label="utility">
          {["{T}", "{Q}", "{S}"].map((c) => (
            <ManaCost key={c} cost={c} size="md" />
          ))}
        </Row>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-7">
          {[
            { token: "--mtg-white", code: "W" },
            { token: "--mtg-blue", code: "U" },
            { token: "--mtg-black", code: "B" },
            { token: "--mtg-red", code: "R" },
            { token: "--mtg-green", code: "G" },
            { token: "--mtg-colorless", code: "C" },
            { token: "--mtg-multicolor", code: "M" },
          ].map((s) => (
            <div
              key={s.token}
              className="flex items-center gap-2 rounded-md bg-[var(--surface-inset)] p-2"
            >
              <span
                className="inline-flex size-6 items-center justify-center rounded-full font-[var(--font-mono)] text-[10px] font-bold text-[var(--brand-fg)]"
                style={{ background: `var(${s.token})` }}
              >
                {s.code}
              </span>
              <span className="font-[var(--font-mono)] text-[10px] text-[var(--text-secondary)]">
                {s.token}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
      <span className="w-32 shrink-0 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

/* ────────────────────────── Sets ────────────────────────── */

function Sets() {
  return (
    <Section
      label="11 — Sets"
      title="Keyrune set glyphs"
      desc="Every printing in the inventory table and on the card detail page identifies its set with the canonical glyph plus the set code in mono caps."
    >
      <div className="space-y-2 rounded-md bg-[var(--surface-raised)] p-5">
        {[
          { code: "neo", label: "Kamigawa: Neon Dynasty" },
          { code: "cmr", label: "Commander Legends" },
          { code: "lea", label: "Limited Edition Alpha" },
          { code: "mh3", label: "Modern Horizons 3" },
          { code: "blb", label: "Bloomburrow" },
        ].map((s) => (
          <div
            key={s.code}
            className="flex items-center gap-4 rounded-md bg-[var(--surface-inset)] px-4 py-2.5"
          >
            <span className="flex items-center gap-2">
              <SetSymbol setCode={s.code} rarity="mythic" size="lg" />
              <SetSymbol setCode={s.code} rarity="rare" size="md" />
              <SetSymbol setCode={s.code} rarity="uncommon" size="sm" />
              <SetSymbol setCode={s.code} rarity="common" size="sm" />
            </span>
            <span className="font-[var(--font-mono)] text-[12px] uppercase tracking-[0.18em] text-[var(--text-primary)]">
              {s.code}
            </span>
            <span className="text-[13px] text-[var(--text-secondary)]">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ────────────────────────── Buttons ────────────────────────── */

function Buttons() {
  return (
    <Section
      label="12 — Buttons"
      title="States of the primary affordance"
      desc="Primary (amber brand) carries the single dominant action per screen. Secondary, ghost, and outline recede. Destructive uses the negative-value token."
    >
      <div className="rounded-md bg-[var(--surface-raised)] p-5">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              <th className="py-2"></th>
              <th className="py-2">Default</th>
              <th className="py-2">Hover</th>
              <th className="py-2">Loading</th>
              <th className="py-2">Disabled</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            <tr className="border-b border-[var(--border-subtle)]">
              <td className="py-3 pr-4 font-[var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                Primary
              </td>
              <td className="py-3 pr-4">
                <BtnPrimary>Add to deck</BtnPrimary>
              </td>
              <td className="py-3 pr-4">
                <BtnPrimary hover>Add to deck</BtnPrimary>
              </td>
              <td className="py-3 pr-4">
                <BtnPrimary>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving…
                </BtnPrimary>
              </td>
              <td className="py-3 pr-4">
                <BtnPrimary disabled>Add to deck</BtnPrimary>
              </td>
            </tr>
            <tr className="border-b border-[var(--border-subtle)]">
              <td className="py-3 pr-4 font-[var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                Secondary
              </td>
              <td className="py-3 pr-4">
                <BtnSecondary>Cancel</BtnSecondary>
              </td>
              <td className="py-3 pr-4">
                <BtnSecondary hover>Cancel</BtnSecondary>
              </td>
              <td className="py-3 pr-4">
                <BtnSecondary>
                  <Loader2 className="size-3.5 animate-spin" /> Loading
                </BtnSecondary>
              </td>
              <td className="py-3 pr-4">
                <BtnSecondary disabled>Cancel</BtnSecondary>
              </td>
            </tr>
            <tr className="border-b border-[var(--border-subtle)]">
              <td className="py-3 pr-4 font-[var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                Ghost
              </td>
              <td className="py-3 pr-4">
                <BtnGhost>Skip</BtnGhost>
              </td>
              <td className="py-3 pr-4">
                <BtnGhost hover>Skip</BtnGhost>
              </td>
              <td className="py-3 pr-4">
                <BtnGhost>
                  <Loader2 className="size-3.5 animate-spin" /> Loading
                </BtnGhost>
              </td>
              <td className="py-3 pr-4">
                <BtnGhost disabled>Skip</BtnGhost>
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-[var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                Destructive
              </td>
              <td className="py-3 pr-4">
                <BtnDestructive>Delete</BtnDestructive>
              </td>
              <td className="py-3 pr-4">
                <BtnDestructive hover>Delete</BtnDestructive>
              </td>
              <td className="py-3 pr-4">
                <BtnDestructive>
                  <Loader2 className="size-3.5 animate-spin" /> Deleting
                </BtnDestructive>
              </td>
              <td className="py-3 pr-4">
                <BtnDestructive disabled>Delete</BtnDestructive>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function btnBase(extra: string) {
  return `inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-[var(--font-display)] text-[12px] font-semibold transition-colors ${extra}`;
}
function BtnPrimary({
  children,
  hover,
  disabled,
}: {
  children: React.ReactNode;
  hover?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={btnBase(
        `text-[var(--brand-fg)] ${hover ? "bg-[var(--brand-strong)]" : "bg-[var(--brand)]"} ${disabled ? "opacity-50" : ""}`,
      )}
    >
      {children}
    </button>
  );
}
function BtnSecondary({
  children,
  hover,
  disabled,
}: {
  children: React.ReactNode;
  hover?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={btnBase(
        `border border-[var(--border-default)] text-[var(--text-primary)] ${hover ? "bg-[var(--surface-overlay)] border-[var(--border-strong)]" : "bg-[var(--surface-raised)]"} ${disabled ? "opacity-50" : ""}`,
      )}
    >
      {children}
    </button>
  );
}
function BtnGhost({
  children,
  hover,
  disabled,
}: {
  children: React.ReactNode;
  hover?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={btnBase(
        `${hover ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"} ${disabled ? "opacity-50" : ""}`,
      )}
    >
      {children}
    </button>
  );
}
function BtnDestructive({
  children,
  hover,
  disabled,
}: {
  children: React.ReactNode;
  hover?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={btnBase(
        `border border-[var(--value-negative)]/40 ${hover ? "bg-[var(--value-negative)] text-white" : "bg-transparent text-[var(--value-negative)]"} ${disabled ? "opacity-50" : ""}`,
      )}
    >
      {children}
    </button>
  );
}

/* ────────────────────────── States ────────────────────────── */

function States() {
  return (
    <Section
      label="13 — States"
      title="Empty / loading / error"
      desc="Trading-desk voice everywhere: terse, professional, no exclamations. Loading states match the shape of the eventual content."
    >
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-md bg-[var(--surface-raised)] p-5">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            empty
          </p>
          <div className="mt-3 rounded-md border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center">
            <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Empty inventory
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Press{" "}
              <kbd className="rounded-sm border border-[var(--border-default)] bg-[var(--surface-inset)] px-1 font-[var(--font-mono)] text-[10px]">
                ⌘K
              </kbd>{" "}
              to search and add your first card.
            </p>
          </div>
        </div>
        <div className="rounded-md bg-[var(--surface-raised)] p-5">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            loading
          </p>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
        <div className="rounded-md bg-[var(--surface-raised)] p-5">
          <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--value-negative)]">
            error
          </p>
          <div className="mt-3 rounded-md border border-[var(--value-negative)]/30 bg-[var(--value-negative)]/8 p-3 text-[13px] text-[var(--value-negative)]">
            <p className="font-medium">Couldn&rsquo;t reach Commander Spellbook.</p>
            <p className="mt-1 text-[12px] opacity-80">
              Bracket estimate may be conservative.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ────────────────────────── Theme comparison ────────────────────────── */

function ThemeComparison() {
  return (
    <Section
      label="14 — Theme parity"
      title="Dark default · light override"
      desc="Both themes derive from identical tokens. The light side is for daytime; dark is the working mode."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {[
          { mode: "dark" as const, label: "Dark · default" },
          { mode: "light" as const, label: "Light · override" },
        ].map((m) => (
          <div
            key={m.mode}
            className={
              m.mode === "light"
                ? "light overflow-hidden rounded-md bg-[var(--surface-base)] ring-1 ring-[var(--border-subtle)]"
                : "overflow-hidden rounded-md bg-[var(--surface-base)] ring-1 ring-[var(--border-subtle)]"
            }
          >
            <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-2 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              {m.label}
            </div>
            <div className="space-y-3 p-5">
              <p className="font-[var(--font-display)] text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
                Atraxa Superfriends
              </p>
              <p className="num text-[28px] font-semibold leading-none text-[var(--text-primary)]">
                $1,247.83
              </p>
              <p className="num text-[12px] text-[var(--value-positive)]">
                ▲ +$142.50 · +12.95%
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 font-[var(--font-display)] text-[12px] font-semibold text-[var(--brand-fg)]">
                  <Check className="size-3" /> Save
                </button>
                <button className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 font-[var(--font-display)] text-[12px] font-semibold text-[var(--text-primary)]">
                  Cancel
                </button>
                <span
                  className="num inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    color: "var(--bracket-3)",
                    background:
                      "color-mix(in oklch, var(--bracket-3) 15%, transparent)",
                    borderColor:
                      "color-mix(in oklch, var(--bracket-3) 35%, transparent)",
                  }}
                >
                  B3
                </span>
                <ManaCost cost="{G}{W}{U}{B}" size="md" />
              </div>
              <div className="flex items-center gap-3 rounded-md bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--border-subtle)]">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--surface-inset)] text-[var(--text-muted)] ring-1 ring-[var(--border-subtle)]">
                  <ImageOff className="size-3" />
                </span>
                <span className="flex-1 text-[13px] text-[var(--text-primary)]">
                  Sol Ring
                </span>
                <span className="num text-[12px] text-[var(--text-secondary)]">
                  $1.43
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
