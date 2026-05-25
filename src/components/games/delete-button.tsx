"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { Button } from "@/components/ui/button";

export function DeleteGameButton({ gameId }: { gameId: string }) {
  const router = useRouter();

  const onDelete = () => {
    confirmToast("Delete this game?", {
      description:
        "Removes the row and its player records. Stats will update accordingly.",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/games/${gameId}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success("Game deleted");
          router.push("/games");
          router.refresh();
        } catch (err) {
          toast.error(
            `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={onDelete}>
      <Trash2 className="size-3.5" /> Delete
    </Button>
  );
}
