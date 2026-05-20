export function ShortcutFooter() {
  const shortcuts: Array<{ key: string; label: string }> = [
    { key: "/", label: "search" },
    { key: "↵", label: "add" },
    { key: "⌫", label: "remove" },
    { key: "⌘/", label: "owned only" },
    { key: "⌘B", label: "bracket" },
    { key: "⌘S", label: "snapshot" },
    { key: "⌘K", label: "global" },
  ];
  return (
    <footer className="sticky bottom-0 z-20 border-t border-border-subtle bg-surface-base/95 px-4 py-1.5 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
        {shortcuts.map((s, i) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            {i > 0 && <span className="opacity-40">·</span>}
            <kbd className="rounded-sm border border-border-subtle bg-surface-raised px-1 py-0 font-mono text-[10px] text-text-secondary">
              {s.key}
            </kbd>
            <span>{s.label}</span>
          </span>
        ))}
      </div>
    </footer>
  );
}
