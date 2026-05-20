export function ShortcutFooter() {
  return (
    <footer className="border-t bg-muted/30 px-4 py-1.5 text-[11px] text-muted-foreground">
      <kbd className="rounded border bg-card px-1">/</kbd> search ·{" "}
      <kbd className="rounded border bg-card px-1">↵</kbd> add ·{" "}
      <kbd className="rounded border bg-card px-1">⌫</kbd> remove ·{" "}
      <kbd className="rounded border bg-card px-1">⌘B</kbd> bracket ·{" "}
      <kbd className="rounded border bg-card px-1">⌘S</kbd> snapshot ·{" "}
      <kbd className="rounded border bg-card px-1">⌘K</kbd> global search
    </footer>
  );
}
