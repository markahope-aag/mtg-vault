"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommanderSearch, type CommanderPick } from "./commander-search";
import { DECK_ARCHETYPE_SUGGESTIONS } from "@/lib/decks/schemas";

export type DeckFormState = {
  name: string;
  commander: CommanderPick | null;
  partner: CommanderPick | null;
  targetBracket: number | null;
  archetype: string;
  notes: string;
  isPrimary: boolean;
};

export function defaultDeckForm(): DeckFormState {
  return {
    name: "",
    commander: null,
    partner: null,
    targetBracket: null,
    archetype: "",
    notes: "",
    isPrimary: false,
  };
}

export function DeckFormFields({
  form,
  onChange,
}: {
  form: DeckFormState;
  onChange: (next: DeckFormState) => void;
}) {
  const [showPartner, setShowPartner] = useState(form.partner != null);

  const canPartner = !!(
    form.commander?.oracleText &&
    /partner/i.test(form.commander.oracleText)
  );

  function patch<K extends keyof DeckFormState>(
    key: K,
    value: DeckFormState[K],
  ) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="deck-name">Name</Label>
        <Input
          id="deck-name"
          value={form.name}
          onChange={(e) => patch("name", e.target.value)}
          placeholder="Atraxa Superfriends"
          required
          maxLength={100}
        />
      </div>

      <CommanderSearch
        value={form.commander}
        onChange={(c) => {
          onChange({
            ...form,
            commander: c,
            partner: c == null ? null : form.partner,
          });
          if (c == null) setShowPartner(false);
        }}
      />

      {canPartner && (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPartner}
              onChange={(e) => {
                setShowPartner(e.target.checked);
                if (!e.target.checked) patch("partner", null);
              }}
              className="size-4"
            />
            Add a partner / Background
          </label>
          {showPartner && (
            <CommanderSearch
              value={form.partner}
              onChange={(p) => patch("partner", p)}
              label="Partner"
              placeholder="Search partners…"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Target bracket</Label>
          <Select
            value={form.targetBracket?.toString() ?? "__none"}
            onValueChange={(v) =>
              patch(
                "targetBracket",
                !v || v === "__none" ? null : Number.parseInt(v, 10),
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Not set</SelectItem>
              <SelectItem value="1">Bracket 1 — Exhibition</SelectItem>
              <SelectItem value="2">Bracket 2 — Core</SelectItem>
              <SelectItem value="3">Bracket 3 — Upgraded</SelectItem>
              <SelectItem value="4">Bracket 4 — Optimized</SelectItem>
              <SelectItem value="5">Bracket 5 — cEDH</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deck-archetype">Archetype</Label>
          <ArchetypeInput
            value={form.archetype}
            onChange={(v) => patch("archetype", v)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deck-notes">Notes</Label>
        <Textarea
          id="deck-notes"
          rows={3}
          value={form.notes}
          onChange={(e) => patch("notes", e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isPrimary}
          onChange={(e) => patch("isPrimary", e.target.checked)}
          className="size-4"
        />
        Primary (sleeved up / built physically)
      </label>
    </div>
  );
}

/**
 * Free-text archetype input with a themed autocomplete dropdown. Replaces
 * the native <datalist>, which is rendered by the browser/OS and can't be
 * styled (looks like a glaring white menu in dark mode).
 */
function ArchetypeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = value.trim().toLowerCase();
  const filtered = q
    ? DECK_ARCHETYPE_SUGGESTIONS.filter((s) =>
        s.toLowerCase().includes(q),
      )
    : DECK_ARCHETYPE_SUGGESTIONS;

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id="deck-archetype"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Voltron, Aristocrats, …"
        maxLength={80}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] py-1 shadow-lg shadow-black/30"
        >
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // mousedown fires before blur; lets the click register before
                  // the input loses focus and closes the menu.
                  e.preventDefault();
                  onChange(s);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-inset/60 hover:text-text-primary"
              >
                <span>{s}</span>
                {value.trim().toLowerCase() === s.toLowerCase() && (
                  <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--brand)]">
                    selected
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function deckFormToPayload(form: DeckFormState) {
  return {
    name: form.name.trim(),
    commanderPrintingId: form.commander?.printingId ?? null,
    partnerPrintingId: form.partner?.printingId ?? null,
    targetBracket: form.targetBracket,
    archetype: form.archetype.trim() || null,
    notes: form.notes.trim() || null,
    isPrimary: form.isPrimary,
  };
}
