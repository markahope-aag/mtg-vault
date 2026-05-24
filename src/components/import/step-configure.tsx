"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationSelect } from "@/components/location-select";
import { Stat } from "./parts";
import type { ImportMode, PreviewResponse } from "./types";

export function StepConfigure({
  preview,
  defaultLocation,
  setDefaultLocation,
  purchasedFromDefault,
  setPurchasedFromDefault,
  mode,
  setMode,
  onBack,
  onNext,
}: {
  preview: PreviewResponse;
  defaultLocation: string;
  setDefaultLocation: (v: string) => void;
  purchasedFromDefault: string;
  setPurchasedFromDefault: (v: string) => void;
  mode: ImportMode;
  setMode: (v: ImportMode) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Detected format:{" "}
            <Badge variant="secondary" className="ml-1 uppercase">
              {preview.format}
            </Badge>
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {preview.filename}
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Total rows" value={preview.totalRows} />
            <Stat
              label="Matched"
              value={preview.matched.length}
              tone="green"
            />
            <Stat
              label="Ambiguous"
              value={preview.ambiguous.length}
              tone="amber"
            />
            <Stat
              label="Unmatched"
              value={preview.unmatched.length}
              tone="red"
            />
          </div>
        </CardContent>
      </Card>

      {preview.duplicateOfPriorBatch && preview.priorBatch && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium text-amber-900">
              ⚠ Duplicate of a recent import
            </p>
            <p className="mt-1 text-amber-800/90">
              A file with this exact content was imported as batch{" "}
              <code className="rounded bg-amber-100 px-1 text-xs">
                {preview.priorBatch.id.slice(0, 8)}
              </code>{" "}
              ({preview.priorBatch.filename},{" "}
              {preview.priorBatch.importedRows} rows) on{" "}
              {new Date(preview.priorBatch.createdAt).toLocaleString()}. You
              can continue if this is intentional.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="defaultLocation">Default location (required)</Label>
            <LocationSelect
              value={defaultLocation}
              onChange={setDefaultLocation}
              placeholder="Pick a location"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchasedFromDefault">
              Default &ldquo;purchased from&rdquo; (optional)
            </Label>
            <Input
              id="purchasedFromDefault"
              value={purchasedFromDefault}
              onChange={(e) => setPurchasedFromDefault(e.target.value)}
              placeholder="Card Kingdom, TCGPlayer, …"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as ImportMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="append">
                  Append — add to existing inventory
                </SelectItem>
                <SelectItem value="replace_location">
                  Replace at location — dispose existing rows there first
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button disabled={!defaultLocation.trim()} onClick={onNext}>
          Next: review unmatched <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
