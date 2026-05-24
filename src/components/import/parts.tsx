import { Badge } from "@/components/ui/badge";
import { ImgWithFallback } from "@/components/img-with-fallback";
import type { SourceRow } from "./types";

// Small presentational widgets shared across the wizard steps.

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "red"
          ? "text-rose-700"
          : "";
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

export function Thumb({ src }: { src: string | null }) {
  return (
    <ImgWithFallback
      src={src}
      alt=""
      className="size-8 rounded object-cover"
      fallbackClassName="flex size-8 items-center justify-center rounded bg-muted text-muted-foreground"
      fallbackIconClassName="size-3.5"
      loading="lazy"
    />
  );
}

export function SourceLine({ row }: { row: SourceRow }) {
  return (
    <p className="text-xs text-muted-foreground">
      Row {row.sourceRowIndex}:{" "}
      <span className="text-foreground">{row.name}</span> ·{" "}
      <span className="uppercase">{row.setCode}</span> · #{row.collectorNumber}{" "}
      · qty {row.quantity}
      {row.foil && (
        <Badge variant="secondary" className="ml-1 text-[10px]">
          foil
        </Badge>
      )}
    </p>
  );
}
