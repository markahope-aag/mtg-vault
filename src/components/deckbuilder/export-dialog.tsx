"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { DeckDetail } from "@/lib/decks/types";
import { BASIC_LAND_NAMES } from "@/lib/curated/any-number-allowed";

function formatLine(name: string, setCode: string, collectorNumber: string) {
  if (BASIC_LAND_NAMES.has(name)) return `1 ${name}`;
  return `1 ${name} (${setCode.toUpperCase()}) ${collectorNumber}`;
}

export function ExportDialog({
  open,
  onOpenChange,
  deck,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  deck: DeckDetail;
}) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    const lines: string[] = [];
    if (deck.commander) {
      lines.push("// Commander");
      lines.push(
        formatLine(
          deck.commander.name,
          deck.commander.printing.setCode,
          deck.commander.printing.collectorNumber,
        ),
      );
    }
    if (deck.partner) {
      lines.push(
        formatLine(
          deck.partner.name,
          deck.partner.printing.setCode,
          deck.partner.printing.collectorNumber,
        ),
      );
    }
    const main = deck.cards.filter((c) => c.deckCardRow.category === "main");
    if (main.length > 0) {
      if (lines.length > 0) lines.push("");
      for (const c of main) {
        for (let i = 0; i < c.deckCardRow.quantity; i++) {
          lines.push(
            formatLine(
              c.card.name,
              c.printing.setCode,
              c.printing.collectorNumber,
            ),
          );
        }
      }
    }
    const maybe = deck.cards.filter(
      (c) => c.deckCardRow.category === "maybeboard",
    );
    if (maybe.length > 0) {
      lines.push("");
      lines.push("// Maybeboard");
      for (const c of maybe) {
        for (let i = 0; i < c.deckCardRow.quantity; i++) {
          lines.push(
            formatLine(
              c.card.name,
              c.printing.setCode,
              c.printing.collectorNumber,
            ),
          );
        }
      }
    }
    // Strategy "Buy" picks land in the "considering" category. They aren't
    // part of the playable deck, but the user explicitly told the tool they
    // plan to acquire them — silently dropping them on export loses that
    // intent. Emit them under a clearly labelled section so importers that
    // honor comments preserve the grouping.
    const considering = deck.cards.filter(
      (c) => c.deckCardRow.category === "considering",
    );
    if (considering.length > 0) {
      lines.push("");
      lines.push("// Considering (Strategy 'Buy' picks — not yet acquired)");
      for (const c of considering) {
        for (let i = 0; i < c.deckCardRow.quantity; i++) {
          lines.push(
            formatLine(
              c.card.name,
              c.printing.setCode,
              c.printing.collectorNumber,
            ),
          );
        }
      }
    }
    return lines.join("\n");
  }, [deck]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export decklist</DialogTitle>
          <DialogDescription>
            Compatible with Moxfield, Archidekt, and any other importer that
            accepts the standard text format.
          </DialogDescription>
        </DialogHeader>
        {/* field-sizing-fixed overrides the Textarea's default
            field-sizing-content, which would auto-grow it to fit a 100-line
            decklist and push the dialog off-screen. */}
        <Textarea
          readOnly
          value={text}
          className="field-sizing-fixed h-[55vh] resize-none font-mono text-xs"
        />
        <div className="flex justify-end">
          <Button onClick={onCopy} variant="outline">
            {copied ? (
              <>
                <Check className="size-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copy to clipboard
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
