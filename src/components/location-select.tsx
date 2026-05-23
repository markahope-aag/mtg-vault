"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none";

type LocationRow = { id: string; name: string };

/**
 * Picks from the canonical /api/locations list. Empty value = no location.
 * If the row's current location isn't in the canonical list (legacy / custom),
 * it's added to the options so editing existing rows doesn't lose the value.
 * New locations are added on the System page.
 */
export function LocationSelect({
  value,
  onChange,
  placeholder = "No location",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/locations")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { locations?: LocationRow[] } | null) => {
        if (cancelled) return;
        const names = (d?.locations ?? []).map((l) => l.name);
        setOptions(names);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // If current value isn't in the canonical list, include it as an option so
  // legacy rows keep displaying their value.
  const visible = value && !options.includes(value) ? [value, ...options] : options;

  return (
    <Select
      value={value || NONE}
      onValueChange={(v) => onChange(!v || v === NONE ? "" : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {visible.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
