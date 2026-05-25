"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddSourceForm } from "./market-sources/add-source-form";
import { SourceRow } from "./market-sources/source-row";
import type { Source, Template } from "./market-sources/types";

export function MarketSourcesAdmin({
  sources,
  templates,
}: {
  sources: Source[];
  templates: Template[];
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd((s) => !s)}>
          <Plus className="size-4" /> Add source
        </Button>
      </div>

      {showAdd && (
        <AddSourceForm templates={templates} onDone={() => setShowAdd(false)} />
      )}

      {sources.length === 0 && !showAdd && (
        <Card>
          <CardContent className="px-6 py-12 text-center text-sm text-text-muted">
            No scraper sources configured. Click <strong>Add source</strong>{" "}
            to wire up an LGS.
          </CardContent>
        </Card>
      )}

      {sources.map((s) => (
        <SourceRow key={s.id} source={s} />
      ))}
    </div>
  );
}
