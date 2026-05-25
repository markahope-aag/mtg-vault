"use client";

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
import type { Channel, Kind } from "./types";

const COUNTERPARTY_PLACEHOLDER: Record<Kind, string> = {
  purchase: "Card Kingdom, LGS, etc.",
  sale: "TCGPlayer, buyer name, etc.",
  trade: "Trade partner",
};

export function HeaderFields({
  kind,
  counterparty,
  onCounterpartyChange,
  occurredAt,
  onOccurredAtChange,
  channel,
  onChannelChange,
  cashOut,
  onCashOutChange,
  cashIn,
  onCashInChange,
  fees,
  onFeesChange,
  notes,
  onNotesChange,
  showCashOut,
  showCashIn,
}: {
  kind: Kind;
  counterparty: string;
  onCounterpartyChange: (v: string) => void;
  occurredAt: string;
  onOccurredAtChange: (v: string) => void;
  channel: Channel;
  onChannelChange: (v: Channel) => void;
  cashOut: string;
  onCashOutChange: (v: string) => void;
  cashIn: string;
  onCashInChange: (v: string) => void;
  fees: string;
  onFeesChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  showCashOut: boolean;
  showCashIn: boolean;
}) {
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Counterparty
          </Label>
          <Input
            value={counterparty}
            onChange={(e) => onCounterpartyChange(e.target.value)}
            placeholder={COUNTERPARTY_PLACEHOLDER[kind]}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Date
          </Label>
          <Input
            type="date"
            value={occurredAt}
            onChange={(e) => onOccurredAtChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Channel
          </Label>
          <Select
            value={channel}
            onValueChange={(v) => onChannelChange((v as Channel) ?? "other")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lgs">LGS</SelectItem>
              <SelectItem value="online_marketplace">
                Online marketplace
              </SelectItem>
              <SelectItem value="private">Private (person-to-person)</SelectItem>
              <SelectItem value="pack">Pack opening / draft</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {showCashOut && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Cash out
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={cashOut}
                onChange={(e) => onCashOutChange(e.target.value)}
              />
            </div>
          )}
          {showCashIn && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Cash in
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={cashIn}
                onChange={(e) => onCashInChange(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Fees
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={fees}
              onChange={(e) => onFeesChange(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Notes
          </Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Any context to remember — receipts, deal context, etc."
          />
        </div>
      </CardContent>
    </Card>
  );
}
