"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
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

type Source = {
  id: string;
  sourceKey: string;
  displayName: string;
  baseUrl: string;
  parserTemplate: string;
  enabled: boolean;
  robotsAcknowledged: boolean;
  termsNotes: string | null;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  useWebUnlocker: boolean;
  lastRunAt: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};

type Template = {
  key: string;
  displayName: string;
  description: string;
};

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

      {showAdd && <AddSourceForm templates={templates} onDone={() => setShowAdd(false)} />}

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

function AddSourceForm({
  templates,
  onDone,
}: {
  templates: Template[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [sourceKey, setSourceKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [parserTemplate, setParserTemplate] = useState<string>(
    templates[0]?.key ?? "shopify",
  );
  const [robotsAcknowledged, setRobotsAcknowledged] = useState(false);
  const [termsNotes, setTermsNotes] = useState("");
  const [useWebUnlocker, setUseWebUnlocker] = useState(false);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState("5");
  const [rateLimitPerDay, setRateLimitPerDay] = useState("200");
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const res = await fetch("/api/admin/market-sources", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceKey,
            displayName,
            baseUrl,
            parserTemplate,
            robotsAcknowledged,
            termsNotes: termsNotes.trim() || null,
            useWebUnlocker,
            rateLimitPerMinute: Number.parseInt(rateLimitPerMinute, 10),
            rateLimitPerDay: Number.parseInt(rateLimitPerDay, 10),
            enabled: false, // always start disabled — flip after test fetch
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        toast.success("Source added — run Test fetch before enabling.");
        onDone();
        router.refresh();
      } catch (err) {
        toast.error(
          `Couldn't add: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      sourceKey,
      displayName,
      baseUrl,
      parserTemplate,
      robotsAcknowledged,
      termsNotes,
      useWebUnlocker,
      rateLimitPerMinute,
      rateLimitPerDay,
      onDone,
      router,
    ],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Add scraper source</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Source key
              </Label>
              <Input
                required
                value={sourceKey}
                onChange={(e) => setSourceKey(e.target.value)}
                placeholder="example-lgs"
                pattern="[a-z0-9_-]+"
              />
              <p className="text-[10px] text-text-muted">
                Lowercase letters, digits, underscore, hyphen. Used in URLs +
                cache keys.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Display name
              </Label>
              <Input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Example LGS"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Base URL
              </Label>
              <Input
                required
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://example-lgs.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Parser template
              </Label>
              <Select
                value={parserTemplate}
                onValueChange={(v) => setParserTemplate(v ?? "shopify")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-text-muted">
                {templates.find((t) => t.key === parserTemplate)?.description}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Rate limit (per minute / per day)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={rateLimitPerMinute}
                  onChange={(e) => setRateLimitPerMinute(e.target.value)}
                  className="w-20"
                />
                <span className="text-text-muted">/</span>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={rateLimitPerDay}
                  onChange={(e) => setRateLimitPerDay(e.target.value)}
                  className="w-24"
                />
              </div>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Terms notes
              </Label>
              <Textarea
                rows={2}
                value={termsNotes}
                onChange={(e) => setTermsNotes(e.target.value)}
                placeholder="Note where you reviewed the site's robots.txt + terms. e.g. 'robots.txt allows /search; ToS section 4 permits personal-use price checks.'"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border-subtle bg-surface-inset/40 p-3 text-xs">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={robotsAcknowledged}
                onChange={(e) => setRobotsAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I&rsquo;ve reviewed this target&rsquo;s robots.txt + terms of
                service and confirmed scraping is permitted for personal use.
                <span className="block text-text-muted">
                  Required before the adapter can be enabled.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={useWebUnlocker}
                onChange={(e) => setUseWebUnlocker(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Use Bright Data Web Unlocker (paid, requires{" "}
                <code className="font-mono">BRIGHTDATA_API_TOKEN</code>).
                <span className="block text-text-muted">
                  Only needed for targets behind anti-bot (Cloudflare etc.).
                  Most friendly LGS targets work with plain fetch.
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add source"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SourceRow({ source }: { source: Source }) {
  const router = useRouter();
  const [testing, setTesting] = useState(false);

  const toggle = useCallback(
    async (field: "enabled" | "robotsAcknowledged" | "useWebUnlocker", value: boolean) => {
      try {
        const res = await fetch("/api/admin/market-sources", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: source.id, [field]: value }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        toast.success("Updated");
        router.refresh();
      } catch (err) {
        toast.error(
          `Couldn't update: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [source.id, router],
  );

  const testFetch = useCallback(async () => {
    setTesting(true);
    try {
      const res = await fetch(
        `/api/admin/market-sources/${source.id}/test`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.ok) {
        toast.success(body.message);
      } else {
        toast.warning(body.message);
      }
      router.refresh();
    } catch (err) {
      toast.error(
        `Test failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setTesting(false);
    }
  }, [source.id, router]);

  const onDelete = useCallback(() => {
    confirmToast(`Delete "${source.displayName}"?`, {
      description:
        "Removes the source config. Cached listings from this source stay in market_listings but won't refresh.",
      onConfirm: async () => {
        try {
          const res = await fetch(
            `/api/admin/market-sources?id=${source.id}`,
            { method: "DELETE" },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success("Source deleted");
          router.refresh();
        } catch (err) {
          toast.error(
            `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    });
  }, [source.id, source.displayName, router]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">
              {source.displayName}{" "}
              <span className="ml-2 font-mono text-[10px] uppercase text-text-muted">
                {source.sourceKey} · {source.parserTemplate}
              </span>
            </p>
            <p className="truncate font-mono text-[11px] text-text-muted">
              {source.baseUrl}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide",
              source.enabled
                ? "border-[var(--value-positive)]/40 bg-[var(--value-positive)]/10 text-[var(--value-positive)]"
                : "border-border-subtle bg-surface-inset text-text-muted",
            )}
          >
            {source.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={source.robotsAcknowledged}
              onChange={(e) => toggle("robotsAcknowledged", e.target.checked)}
            />
            <span>Robots/terms acknowledged</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={source.enabled}
              disabled={!source.robotsAcknowledged}
              onChange={(e) => toggle("enabled", e.target.checked)}
            />
            <span>Enabled (requires acknowledgment)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={source.useWebUnlocker}
              onChange={(e) => toggle("useWebUnlocker", e.target.checked)}
            />
            <span>Use Bright Data Web Unlocker</span>
          </label>
          <div className="font-mono text-[10px] uppercase text-text-muted">
            Rate limit: {source.rateLimitPerMinute}/min ·{" "}
            {source.rateLimitPerDay}/day
          </div>
        </div>

        {source.termsNotes && (
          <div className="rounded-md border border-border-subtle bg-surface-inset/40 p-2 text-[11px] text-text-secondary">
            <p className="font-mono uppercase tracking-wide text-text-muted">
              Terms notes
            </p>
            <p className="mt-0.5">{source.termsNotes}</p>
          </div>
        )}

        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap gap-3 font-mono uppercase text-text-muted">
            <span>
              Last run:{" "}
              {source.lastRunAt
                ? new Date(source.lastRunAt).toLocaleString()
                : "never"}
            </span>
            <span>
              Last test:{" "}
              {source.lastTestAt ? (
                <span
                  className={
                    source.lastTestOk
                      ? "text-[var(--value-positive)]"
                      : "text-[var(--value-negative)]"
                  }
                >
                  {new Date(source.lastTestAt).toLocaleString()}
                </span>
              ) : (
                "never"
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={testFetch}
              disabled={testing}
            >
              <Zap className="size-3" /> {testing ? "Testing…" : "Test fetch"}
            </Button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-inset hover:text-[var(--value-negative)]"
              aria-label="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {source.lastTestMessage && (
          <p className="text-[11px] italic text-text-muted">
            Last test: {source.lastTestMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
