"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { Template } from "./types";

export function AddSourceForm({
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
