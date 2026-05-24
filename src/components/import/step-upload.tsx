"use client";

import { useRef, useState } from "react";
import { ArrowRight, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StepUpload({
  file,
  setFile,
  uploading,
  onUpload,
}: {
  file: File | null;
  setFile: (f: File | null) => void;
  uploading: boolean;
  onUpload: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload a CSV</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The drop zone is a real button so it's focusable + activatable
            by keyboard (Enter / Space → click → file picker). Drag/drop
            handlers still live on the button element; the hidden <input>
            is the actual file picker that fires when the button is
            clicked or activated by keyboard. */}
        <button
          type="button"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          aria-label={
            file
              ? `Selected ${file.name}. Press to choose a different CSV.`
              : "Drop a CSV here or press to choose one. Supported: ManaBox, Moxfield, Archidekt, TCGPlayer."
          }
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-12 text-center text-sm transition-colors outline-none focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/40 ${
            dragging ? "border-foreground bg-muted" : "border-border"
          }`}
        >
          <Upload className="size-8 text-muted-foreground" aria-hidden />
          {file ? (
            <p className="font-medium">{file.name}</p>
          ) : (
            <>
              <p className="font-medium">Drop a CSV here or click to choose</p>
              <p className="text-xs text-muted-foreground">
                Supported: ManaBox, Moxfield, Archidekt, TCGPlayer
              </p>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-hidden
          tabIndex={-1}
        />
        <p className="text-xs text-muted-foreground">
          Files are capped at 5MB / 25,000 rows. The CSV is parsed but nothing
          is written until you confirm.
        </p>
        <div className="flex justify-end">
          <Button disabled={!file || uploading} onClick={onUpload}>
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Parsing…
              </>
            ) : (
              <>
                Continue <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
