"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

function readInitial(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(readInitial);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
    root.dataset.theme = theme;
    document.cookie = `theme=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="inline-flex size-7 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
    >
      {theme === "dark" ? (
        <Sun className="size-3.5" />
      ) : (
        <Moon className="size-3.5" />
      )}
    </button>
  );
}
