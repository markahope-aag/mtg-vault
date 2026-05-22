"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { HELP_SECTIONS, type HelpSection } from "@/lib/help-content";

function sectionText(section: HelpSection): string {
  const parts = [section.title];
  for (const b of section.blocks) {
    if (b.type === "p") parts.push(b.text);
    else parts.push(...b.items);
  }
  return parts.join(" ").toLowerCase();
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (!lower.includes(q)) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let i = 0;
  let n = 0;
  for (;;) {
    const found = lower.indexOf(q, i);
    if (found === -1) {
      out.push(text.slice(i));
      break;
    }
    if (found > i) out.push(text.slice(i, found));
    out.push(
      <mark
        key={n++}
        className="rounded-sm bg-[var(--brand-soft)] px-0.5 text-[var(--brand-strong)]"
      >
        {text.slice(found, found + q.length)}
      </mark>,
    );
    i = found + q.length;
  }
  return <>{out}</>;
}

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const sections = useMemo(
    () => (q ? HELP_SECTIONS.filter((s) => sectionText(s).includes(q)) : HELP_SECTIONS),
    [q],
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <header className="space-y-2 border-b border-[var(--border-subtle)] pb-5">
        <p className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          Help
        </p>
        <h1 className="font-[var(--font-display)] text-[44px] font-semibold leading-[1.05] tracking-tight">
          User guide
        </h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          How every part of MTG Vault works. Search to jump to a topic.
        </p>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-5">
        {/* Search */}
        <div className="sticky top-2 z-10">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the guide…"
              className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] pl-9 pr-9 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--brand)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {q && (
            <p className="mt-1 font-[var(--font-mono)] text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              {sections.length} section{sections.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {sections.length === 0 ? (
          <p className="empty-terminal py-10 text-center">no matching topics</p>
        ) : (
          <div className="space-y-6">
            {sections.map((s) => (
              <section key={s.id} className="space-y-2">
                <h2 className="font-[var(--font-display)] text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
                  <Highlight text={s.title} query={q} />
                </h2>
                {s.blocks.map((b, i) =>
                  b.type === "p" ? (
                    <p
                      key={i}
                      className="text-[14px] leading-relaxed text-[var(--text-secondary)]"
                    >
                      <Highlight text={b.text} query={q} />
                    </p>
                  ) : (
                    <ul key={i} className="space-y-1">
                      {b.items.map((item, j) => (
                        <li
                          key={j}
                          className="flex gap-2 text-[14px] leading-relaxed text-[var(--text-secondary)]"
                        >
                          <span className="text-[var(--brand)]">·</span>
                          <span>
                            <Highlight text={item} query={q} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
