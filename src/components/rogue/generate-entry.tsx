"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ImgWithFallback } from "@/components/img-with-fallback";

type CommanderHit = {
  oracleId: string;
  name: string;
  imageUri: string | null;
  typeLine: string | null;
};

export function GenerateEntry() {
  const router = useRouter();
  const [commander, setCommander] = useState<CommanderHit | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommanderHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [archetype, setArchetype] = useState("");
  const [bracket, setBracket] = useState<string>("3");
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Commander-only search; same endpoint the deckbuilder uses.
  useEffect(() => {
    if (commander) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=10&commanderOnly=true`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(
          (data.results ?? []).map(
            (r: {
              oracleId: string;
              name: string;
              imageUri: string | null;
              typeLine: string | null;
            }) => ({
              oracleId: r.oracleId,
              name: r.name,
              imageUri: r.imageUri,
              typeLine: r.typeLine,
            }),
          ),
        );
      } catch (err) {
        toast.error(
          `Search failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setSearching(false);
      }
    }, 200);
  }, [query, commander]);

  const onGenerate = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "standard",
          commanderOracleId: commander?.oracleId,
          archetypeBrief: archetype.trim() || undefined,
          targetBracket: bracket ? Number.parseInt(bracket, 10) : null,
        }),
      });
      // The endpoint may take 30-60s. Defensive parse — Vercel timeouts
      // can return HTML.
      const text = await res.text();
      let body: { id?: string; error?: string } = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {
          error:
            "Empty / non-JSON response (the function may have timed out — retry).",
        };
      }
      if (!res.ok || !body.id) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.push(`/decks/new/generate/${body.id}`);
    } catch (err) {
      toast.error(
        `Generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSubmitting(false);
    }
  }, [archetype, bracket, commander, router]);

  const canSubmit =
    !submitting && (commander != null || archetype.trim().length > 0);

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Commander (optional — leave empty to let the model pick one)
          </Label>
          {commander ? (
            <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-inset/40 p-3">
              <ImgWithFallback
                src={commander.imageUri}
                alt={commander.name}
                className="size-12 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                fallbackClassName="flex size-12 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
                fallbackIconClassName="size-4"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{commander.name}</p>
                <p className="truncate font-mono text-[11px] uppercase tracking-wide text-text-muted">
                  {commander.typeLine}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCommander(null);
                  setQuery("");
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-text-muted" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a legendary creature…"
                  className="pl-8"
                />
              </div>
              {query.trim() && (
                <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-border-subtle bg-surface-inset/40 p-1">
                  {searching ? (
                    <li className="px-2 py-1 text-xs text-text-muted">
                      Searching…
                    </li>
                  ) : results.length === 0 ? (
                    <li className="px-2 py-1 text-xs text-text-muted">
                      No commanders match.
                    </li>
                  ) : (
                    results.map((r) => (
                      <li key={r.oracleId}>
                        <button
                          type="button"
                          onClick={() => {
                            setCommander(r);
                            setQuery("");
                            setResults([]);
                          }}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-surface-inset"
                        >
                          <ImgWithFallback
                            src={r.imageUri}
                            alt={r.name}
                            className="size-8 shrink-0 rounded-sm object-cover ring-1 ring-border-subtle"
                            fallbackClassName="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-inset ring-1 ring-border-subtle"
                            fallbackIconClassName="size-3"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{r.name}</p>
                            <p className="truncate font-mono text-[10px] uppercase text-text-muted">
                              {r.typeLine}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Playstyle brief (optional)
          </Label>
          <Textarea
            rows={4}
            value={archetype}
            onChange={(e) => setArchetype(e.target.value)}
            placeholder="What kind of deck do you want? E.g. 'big mana ramp into game-ending threats, no infinite combos', or 'graveyard reanimator with a sacrifice subtheme.'"
          />
          <p className="text-[11px] text-text-muted">
            If you skip the commander and leave this blank, the model picks
            both. Filling this in lets you steer the build.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Target bracket
          </Label>
          <Select
            value={bracket}
            onValueChange={(v) => setBracket(v ?? "3")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">B1 — Exhibition (jank, no game changers)</SelectItem>
              <SelectItem value="2">B2 — Core (precon-level)</SelectItem>
              <SelectItem value="3">B3 — Upgraded</SelectItem>
              <SelectItem value="4">B4 — Optimized (high-power casual)</SelectItem>
              <SelectItem value="5">B5 — cEDH</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button onClick={onGenerate} disabled={!canSubmit}>
            <Sparkles className="size-4" />
            {submitting ? "Starting…" : "Generate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
