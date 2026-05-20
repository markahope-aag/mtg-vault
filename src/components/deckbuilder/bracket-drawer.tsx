"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BracketDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bracket calculation</DialogTitle>
          <DialogDescription>
            Bracket engine coming in Phase 9. It will compute the official
            Commander Bracket (1–5) for this deck and list the exact cards to
            remove to drop a bracket.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
