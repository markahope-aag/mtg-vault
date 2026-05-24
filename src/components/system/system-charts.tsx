"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type RarityPoint = { rarity: string | null; n: number };
export type AcquisitionPoint = { month: string; n: number };
export type BracketPoint = { bracket: number | null; n: number };

const RARITY_COLORS: Record<string, string> = {
  common: "var(--rarity-common)",
  uncommon: "var(--rarity-uncommon)",
  rare: "var(--rarity-rare)",
  mythic: "var(--rarity-mythic)",
  bonus: "var(--rarity-mythic)",
  special: "var(--rarity-mythic)",
};

const BRACKET_COLOR: Record<number, string> = {
  1: "var(--color-bracket-1)",
  2: "var(--color-bracket-2)",
  3: "var(--color-bracket-3)",
  4: "var(--color-bracket-4)",
  5: "var(--color-bracket-5)",
};

const tooltipStyle: React.CSSProperties = {
  background: "var(--surface-overlay)",
  border: "1px solid var(--border-default)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--text-primary)",
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          {title}
        </p>
        {subtitle && (
          <p className="font-[var(--font-mono)] text-[10px] text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      <div className="h-48">{children}</div>
    </div>
  );
}

export function SystemCharts({
  rarity,
  acquisitions,
  brackets,
}: {
  rarity: RarityPoint[];
  acquisitions: AcquisitionPoint[];
  brackets: BracketPoint[];
}) {
  // ─── Rarity donut ───
  const rarityData = rarity
    .filter((r) => r.n > 0)
    .map((r) => ({
      name: r.rarity ?? "unknown",
      value: r.n,
      color: RARITY_COLORS[r.rarity ?? "common"] ?? "var(--text-muted)",
    }));
  const rarityTotal = rarityData.reduce((s, r) => s + r.value, 0);

  // ─── Acquisitions per month ───
  const acqData = acquisitions.map((a) => ({
    month: a.month, // "YYYY-MM"
    label: new Date(`${a.month}-01`).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    }),
    n: a.n,
  }));

  // ─── Bracket distribution ───
  const bracketData = [1, 2, 3, 4, 5].map((b) => {
    const found = brackets.find((x) => x.bracket === b);
    return { bracket: `B${b}`, n: found?.n ?? 0, color: BRACKET_COLOR[b] };
  });
  const unsetCount = brackets.find((b) => b.bracket == null)?.n ?? 0;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* Rarity */}
      <ChartCard
        title="Inventory by rarity"
        subtitle={`${rarityTotal.toLocaleString()} cards`}
      >
        {rarityData.length === 0 ? (
          <p className="empty-terminal mt-12 text-center">no inventory</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={rarityData}
                dataKey="value"
                nameKey="name"
                innerRadius={42}
                outerRadius={70}
                stroke="var(--surface-raised)"
                strokeWidth={2}
                paddingAngle={1}
              >
                {rarityData.map((r, i) => (
                  <Cell key={i} fill={r.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "var(--text-primary)" }}
                formatter={(value, name) => [
                  Number(value).toLocaleString(),
                  String(name),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Acquisitions per month */}
      <ChartCard
        title="Acquisitions / month"
        subtitle="last 12 months"
      >
        {acqData.length === 0 ? (
          <p className="empty-terminal mt-12 text-center">no data</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={acqData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                axisLine={{ stroke: "var(--border-subtle)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-inset)" }}
                contentStyle={tooltipStyle}
                labelStyle={{ color: "var(--text-primary)" }}
                formatter={(value) => [Number(value).toLocaleString(), "Cards"]}
              />
              <Bar dataKey="n" fill="var(--brand)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Bracket distribution */}
      <ChartCard
        title="Decks by target bracket"
        subtitle={unsetCount > 0 ? `${unsetCount} unset` : undefined}
      >
        {bracketData.every((b) => b.n === 0) ? (
          <p className="empty-terminal mt-12 text-center">no brackets set</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={bracketData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="bracket"
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                axisLine={{ stroke: "var(--border-subtle)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-inset)" }}
                contentStyle={tooltipStyle}
                labelStyle={{ color: "var(--text-primary)" }}
                formatter={(value) => [Number(value).toLocaleString(), "Decks"]}
              />
              <Bar dataKey="n" radius={[2, 2, 0, 0]}>
                {bracketData.map((b, i) => (
                  <Cell key={i} fill={b.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
