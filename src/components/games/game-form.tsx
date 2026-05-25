"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { CommanderSearch } from "./commander-search";
import { WIN_TYPES, type WinType } from "@/lib/games/schemas";

type DeckOption = { id: string; name: string };

type Opponent = {
  name: string;
  commanderText: string;
  commanderOracleId: string | null;
};

const WIN_TYPE_LABELS: Record<WinType, string> = {
  combo: "Combo",
  damage: "Damage",
  commander_damage: "Cmd dmg",
  alt_win: "Alt win",
  mill: "Mill",
  poison: "Poison",
  concede: "Concede",
  other: "Other",
};

const BRACKETS = [1, 2, 3, 4, 5] as const;

function isoDateLocal(d: Date): string {
  // datetime-local needs YYYY-MM-DDTHH:mm in the browser's local tz.
  // Plain toISOString() is UTC and would drift the displayed time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GameForm({
  decks,
  defaultDeckId,
}: {
  decks: DeckOption[];
  defaultDeckId: string | null;
}) {
  const router = useRouter();

  const [playedAtLocal, setPlayedAtLocal] = useState(() => isoDateLocal(new Date()));
  const [myDeckId, setMyDeckId] = useState<string | null>(defaultDeckId);
  const [myDeckNameSnapshot, setMyDeckNameSnapshot] = useState("");
  const [podSize, setPodSize] = useState<number>(4);
  const [won, setWon] = useState<boolean | null>(null);
  const [myFinish, setMyFinish] = useState<number | null>(null);
  const [podBracket, setPodBracket] = useState<number | null>(null);
  const [winType, setWinType] = useState<WinType | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [opponents, setOpponents] = useState<Opponent[]>(() =>
    Array.from({ length: 3 }, () => ({
      name: "",
      commanderText: "",
      commanderOracleId: null,
    })),
  );
  const [submitting, setSubmitting] = useState(false);

  // Keep opponent rows synced with podSize: 4 = me + 3 opps.
  const opponentCount = Math.max(0, podSize - 1);
  const visibleOpponents = useMemo(() => {
    const next = [...opponents];
    while (next.length < opponentCount) {
      next.push({ name: "", commanderText: "", commanderOracleId: null });
    }
    return next.slice(0, opponentCount);
  }, [opponents, opponentCount]);

  const setOpponentAt = (i: number, patch: Partial<Opponent>) => {
    setOpponents((prev) => {
      const next = [...prev];
      while (next.length <= i) {
        next.push({ name: "", commanderText: "", commanderOracleId: null });
      }
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const submit = useCallback(
    async (e: React.FormEvent, mode: "save" | "save_and_log_another") => {
      e.preventDefault();
      if (myDeckId == null && myDeckNameSnapshot.trim() === "") {
        toast.error("Pick a deck (or type a name).");
        return;
      }
      if (won == null) {
        toast.error("Did you win? Pick yes or no.");
        return;
      }
      setSubmitting(true);
      try {
        const players = visibleOpponents
          .filter(
            (o) => o.name.trim() !== "" || o.commanderText.trim() !== "",
          )
          .map((o) => ({
            isMe: false,
            playerName: o.name.trim() || null,
            commanderOracleId: o.commanderOracleId,
            commanderNameSnapshot:
              o.commanderText.trim() && !o.commanderOracleId
                ? o.commanderText.trim()
                : null,
          }));

        const body = {
          playedAt: new Date(playedAtLocal).toISOString(),
          myDeckId,
          myDeckNameSnapshot: myDeckNameSnapshot.trim() || null,
          podSize,
          won,
          myFinish: won ? 1 : myFinish,
          podBracket,
          winType,
          durationMinutes: durationMinutes
            ? Number.parseInt(durationMinutes, 10)
            : null,
          notes: notes.trim() || null,
          players,
        };
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error ?? `HTTP ${res.status}`);
        toast.success("Game logged.");

        if (mode === "save_and_log_another") {
          // Stick: pod, bracket, opponents, deck. Flip: result + win type
          // + finish + notes + duration. Update playedAt to "now" so a
          // back-to-back session shows correct ordering.
          setPlayedAtLocal(isoDateLocal(new Date()));
          setWon(null);
          setMyFinish(null);
          setWinType(null);
          setDurationMinutes("");
          setNotes("");
        } else {
          router.push("/games");
          router.refresh();
        }
      } catch (err) {
        toast.error(
          `Couldn't save: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      playedAtLocal,
      myDeckId,
      myDeckNameSnapshot,
      podSize,
      won,
      myFinish,
      podBracket,
      winType,
      durationMinutes,
      notes,
      visibleOpponents,
      router,
    ],
  );

  return (
    <form onSubmit={(e) => submit(e, "save")} className="space-y-5">
      {/* ─── Result + deck ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">The basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-text-muted">
              Did you win?
            </Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWon(true)}
                className={cn(
                  "flex-1 rounded-md border px-4 py-3 text-sm font-medium",
                  won === true
                    ? "border-[var(--value-positive)] bg-[var(--value-positive)]/15 text-[var(--value-positive)]"
                    : "border-border-subtle bg-surface-raised hover:bg-surface-inset",
                )}
              >
                Won
              </button>
              <button
                type="button"
                onClick={() => setWon(false)}
                className={cn(
                  "flex-1 rounded-md border px-4 py-3 text-sm font-medium",
                  won === false
                    ? "border-[var(--value-negative)] bg-[var(--value-negative)]/15 text-[var(--value-negative)]"
                    : "border-border-subtle bg-surface-raised hover:bg-surface-inset",
                )}
              >
                Lost
              </button>
            </div>
            {won === false && (
              <div className="flex items-center gap-2 pt-1">
                <Label className="text-xs uppercase tracking-wide text-text-muted">
                  Finish (optional)
                </Label>
                <div className="flex gap-1">
                  {[2, 3, 4, 5, 6].slice(0, Math.max(0, podSize - 1)).map(
                    (n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMyFinish(n)}
                        className={cn(
                          "size-7 rounded-sm border text-xs",
                          myFinish === n
                            ? "border-text-primary bg-surface-inset"
                            : "border-border-subtle hover:bg-surface-inset",
                        )}
                      >
                        {n}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-text-muted">
                My deck
              </Label>
              <Select
                value={myDeckId ?? "__name"}
                onValueChange={(v) => {
                  if (v === "__name") {
                    setMyDeckId(null);
                  } else {
                    setMyDeckId(v);
                    setMyDeckNameSnapshot("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {decks.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__name">
                    (other / not in MTG Vault)
                  </SelectItem>
                </SelectContent>
              </Select>
              {myDeckId == null && (
                <Input
                  className="mt-1"
                  value={myDeckNameSnapshot}
                  onChange={(e) => setMyDeckNameSnapshot(e.target.value)}
                  placeholder="Deck name"
                />
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-text-muted">
                Played at
              </Label>
              <Input
                type="datetime-local"
                value={playedAtLocal}
                onChange={(e) => setPlayedAtLocal(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Pod + bracket + win type ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">The table</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-text-muted">
              Pod size
            </Label>
            <div className="flex gap-1">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPodSize(n)}
                  className={cn(
                    "size-9 rounded-sm border text-sm font-medium",
                    podSize === n
                      ? "border-text-primary bg-surface-inset"
                      : "border-border-subtle hover:bg-surface-inset",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-text-muted">
              Pod bracket (Rule-0 agreed level)
            </Label>
            <div className="flex gap-1">
              {BRACKETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() =>
                    setPodBracket((curr) => (curr === b ? null : b))
                  }
                  className={cn(
                    "size-9 rounded-sm border text-sm font-medium",
                    podBracket === b
                      ? "border-text-primary bg-surface-inset"
                      : "border-border-subtle hover:bg-surface-inset",
                  )}
                  aria-label={`Bracket ${b}`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {won === true && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-text-muted">
                Win type
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {WIN_TYPES.map((wt) => (
                  <button
                    key={wt}
                    type="button"
                    onClick={() =>
                      setWinType((curr) => (curr === wt ? null : wt))
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      winType === wt
                        ? "border-text-primary bg-surface-inset"
                        : "border-border-subtle hover:bg-surface-inset",
                    )}
                  >
                    {WIN_TYPE_LABELS[wt]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Opponents ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Opponents{" "}
            <span className="font-normal text-text-muted">(all optional)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {visibleOpponents.map((o, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-md border border-border-subtle bg-surface-raised p-3 sm:grid-cols-[120px_1fr_auto]"
            >
              <Input
                value={o.name}
                onChange={(e) => setOpponentAt(i, { name: e.target.value })}
                placeholder={`Player ${i + 1}`}
              />
              <CommanderSearch
                value={o.commanderText}
                onChange={(v) => setOpponentAt(i, { commanderText: v })}
                onSelect={(sel) =>
                  setOpponentAt(i, {
                    commanderOracleId: sel?.oracleId ?? null,
                    commanderText: sel?.name ?? o.commanderText,
                  })
                }
              />
              <button
                type="button"
                onClick={() => {
                  setPodSize((p) => Math.max(2, p - 1));
                  setOpponents((prev) => prev.filter((_, idx) => idx !== i));
                }}
                className="inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-inset hover:text-[var(--value-negative)]"
                aria-label="Remove opponent"
                title="Remove opponent"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {podSize < 6 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPodSize((p) => Math.min(6, p + 1))}
            >
              <Plus className="size-4" /> Add opponent
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── Optional detail ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detail (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-text-muted">
                Duration (min)
              </Label>
              <Input
                type="number"
                min={1}
                max={600}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 75"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-text-muted">
              Notes
            </Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened, who folded what, key turn, etc."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={(e) => submit(e, "save_and_log_another")}
        >
          Log + log another
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Logging…" : "Log game"}
        </Button>
      </div>
    </form>
  );
}
