"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AddCardsDialog,
  type AddDialogCard,
} from "./add-cards-dialog";

// JPEG quality — 0.85 is a good balance: a 3000x4000 phone shot lands
// around 500–900 KB, well inside the API endpoint's 8 MB limit and small
// enough to ship over a slow connection.
const JPEG_QUALITY = 0.85;
// Cap on the largest dimension before encoding. The model doesn't need
// more than 1600px to read a card name; downscaling here cuts upload
// time + API token cost meaningfully.
const MAX_DIM = 1600;

type ScannerState =
  | { kind: "idle" }
  | { kind: "live" }
  | { kind: "captured"; dataUrl: string }
  | { kind: "scanning"; dataUrl: string }
  | {
      kind: "matched";
      dataUrl: string;
      card: AddDialogCard;
      confidence: "high" | "medium" | "low";
    }
  | {
      kind: "candidates";
      dataUrl: string;
      scannedName: string | null;
      candidates: Array<{ oracleId: string; name: string }>;
      notes: string | null;
    }
  | { kind: "error"; message: string };

export function ScanCardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [state, setState] = useState<ScannerState>({ kind: "idle" });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setState({
        kind: "error",
        message:
          "Camera access isn't available in this browser. Try a phone or a Chromium-based desktop browser over HTTPS.",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // Prefer the rear camera on phones; falls back to whatever is
          // available on desktop.
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState({ kind: "live" });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error
            ? `Camera permission denied or unavailable: ${err.message}`
            : "Camera permission denied or unavailable.",
      });
    }
  }, []);

  // Stop the stream when the dialog closes; restart it when the dialog
  // opens and we're in the "live" state.
  useEffect(() => {
    if (!open) {
      stopStream();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: "idle" });
      setShowAddDialog(false);
      return;
    }
    void startCamera();
    return () => stopStream();
  }, [open, startCamera, stopStream]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      toast.error("Camera not ready yet — give it a moment.");
      return;
    }
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      toast.error("Camera frame not available.");
      return;
    }
    const scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Couldn't create canvas to encode the frame.");
      return;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    stopStream();
    setState({ kind: "captured", dataUrl });
  }, [stopStream]);

  const submit = useCallback(async (dataUrl: string) => {
    setState({ kind: "scanning", dataUrl });
    try {
      const base64 = dataUrl.split(",")[1];
      const mediaType =
        dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";
      const res = await fetch("/api/scan-card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      if (body.match) {
        setState({
          kind: "matched",
          dataUrl,
          card: {
            oracleId: body.match.oracleId,
            name: body.match.name,
            printings: body.match.printings,
          },
          confidence: body.scan.confidence,
        });
      } else {
        setState({
          kind: "candidates",
          dataUrl,
          scannedName: body.scan.name,
          candidates: body.candidates ?? [],
          notes: body.scan.notes,
        });
      }
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error
            ? `Scan failed: ${err.message}`
            : "Scan failed.",
      });
    }
  }, []);

  const retake = useCallback(() => {
    setState({ kind: "idle" });
    void startCamera();
  }, [startCamera]);

  const pickCandidate = useCallback(async (oracleId: string) => {
    // Fetch full card detail so we have the printings list AddCardsDialog
    // needs. Same endpoint as the manual picker.
    try {
      const res = await fetch(`/api/cards/${oracleId}/detail`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const card: AddDialogCard = {
        oracleId: data.card.oracleId,
        name: data.card.name,
        printings: data.printings,
      };
      setState((s) =>
        s.kind === "candidates" || s.kind === "matched"
          ? { kind: "matched", dataUrl: s.dataUrl, card, confidence: "low" }
          : s,
      );
    } catch (err) {
      toast.error(
        `Couldn't load card: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, []);

  const acceptMatch = useCallback(() => {
    setShowAddDialog(true);
  }, []);

  return (
    <>
      <Dialog open={open && !showAddDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto p-0">
          <DialogHeader className="border-b border-border-subtle px-4 py-3">
            <DialogTitle className="text-base">Scan a card</DialogTitle>
            <DialogDescription className="text-xs">
              Point the camera at a card. Fill the frame with the card so the
              name is clearly readable.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 p-4">
            {/* Video preview */}
            {state.kind === "idle" || state.kind === "live" ? (
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-surface-inset">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-4 rounded-md border-2 border-dashed border-white/40" />
              </div>
            ) : state.kind === "error" ? (
              <div className="rounded-lg border border-[var(--value-negative)]/40 bg-[var(--value-negative)]/10 p-4 text-sm">
                <p className="font-medium text-[var(--value-negative)]">
                  Couldn&rsquo;t open the camera
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {state.message}
                </p>
              </div>
            ) : (
              // Show the captured still while scanning / showing results.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.dataUrl}
                alt="Captured card"
                className="aspect-[3/4] w-full rounded-lg object-cover"
              />
            )}

            {/* Status / actions per state */}
            {state.kind === "live" && (
              <Button onClick={capture} size="lg" className="w-full">
                <Camera className="size-4" /> Capture
              </Button>
            )}

            {state.kind === "captured" && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={retake} className="flex-1">
                  <RefreshCw className="size-4" /> Retake
                </Button>
                <Button
                  onClick={() => submit(state.dataUrl)}
                  className="flex-1"
                >
                  Identify
                </Button>
              </div>
            )}

            {state.kind === "scanning" && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-text-muted">
                <Loader2 className="size-4 animate-spin" />
                Identifying…
              </div>
            )}

            {state.kind === "matched" && (
              <div className="space-y-3">
                <div className="rounded-md border border-border-subtle bg-surface-inset/40 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    Identified
                  </p>
                  <p className="mt-1 font-medium">{state.card.name}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Confidence: {state.confidence} ·{" "}
                    {state.card.printings.length} printing
                    {state.card.printings.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={retake} className="flex-1">
                    <RefreshCw className="size-4" /> Retake
                  </Button>
                  <Button onClick={acceptMatch} className="flex-1">
                    Add to inventory
                  </Button>
                </div>
              </div>
            )}

            {state.kind === "candidates" && (
              <div className="space-y-3">
                <div className="rounded-md border border-border-subtle bg-surface-inset/40 p-3 text-xs">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                    No exact match
                  </p>
                  {state.scannedName ? (
                    <p className="mt-1 text-text-secondary">
                      The model read &ldquo;
                      <span className="font-medium text-text-primary">
                        {state.scannedName}
                      </span>
                      &rdquo; but it didn&rsquo;t match a card in our database.
                    </p>
                  ) : (
                    <p className="mt-1 text-text-secondary">
                      Couldn&rsquo;t read the card name from the photo.
                    </p>
                  )}
                  {state.notes && (
                    <p className="mt-1 italic text-text-muted">{state.notes}</p>
                  )}
                </div>
                {state.candidates.length > 0 && (
                  <>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                      Did you mean?
                    </p>
                    <ul className="space-y-1">
                      {state.candidates.map((c) => (
                        <li key={c.oracleId}>
                          <button
                            type="button"
                            onClick={() => pickCandidate(c.oracleId)}
                            className="flex w-full items-center justify-between rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-left text-sm hover:bg-surface-inset"
                          >
                            <span>{c.name}</span>
                            <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                              Use
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <Button variant="outline" onClick={retake} className="w-full">
                  <RefreshCw className="size-4" /> Retake
                </Button>
              </div>
            )}

            {state.kind === "error" && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  <X className="size-4" /> Close
                </Button>
                <Button onClick={retake} className="flex-1">
                  <RefreshCw className="size-4" /> Try again
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Handing off to the existing Add to inventory flow keeps us from
          duplicating every condition/location/finish field. */}
      {state.kind === "matched" && (
        <AddCardsDialog
          card={state.card}
          open={showAddDialog}
          onOpenChange={(v) => {
            setShowAddDialog(v);
            if (!v) onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
