"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/decks", label: "Decks" },
  { href: "/trades", label: "Trades" },
  { href: "/games", label: "Games" },
  { href: "/market", label: "Market" },
  { href: "/import", label: "Import" },
  { href: "/system", label: "System" },
  { href: "/help", label: "Help" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Close the drawer on route change. usePathname returns a new value
  // synchronously when the route changes, so this fires immediately.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close + Tab-key focus trap. While the drawer is open, Tab
  // and Shift+Tab cycle through the drawer's tabbables (close button
  // + nav links) without escaping behind the overlay. Focus moves to
  // the first tabbable on open and back to the trigger button on
  // close — both standard dialog patterns the previous implementation
  // skipped.
  useEffect(() => {
    if (!open) return;

    const tabbables = (): HTMLElement[] => {
      const root = drawerRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
    };

    // Initial focus: first tabbable in the drawer (close button).
    const initial = tabbables()[0];
    initial?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const list = tabbables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (active && !drawerRef.current?.contains(active)) {
        // Focus drifted outside the drawer somehow — yank it back.
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [open]);

  // Restore focus to the trigger when the drawer closes. Skipping the
  // initial-render case so screen readers don't get a phantom focus
  // announcement on mount.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      triggerRef.current?.focus();
      wasOpenRef.current = false;
    }
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-md text-text-primary hover:bg-surface-inset sm:hidden"
        aria-label="Open navigation"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div
          ref={drawerRef}
          className="fixed inset-0 z-50 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[260px] flex-col border-l border-border-subtle bg-surface-base shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-text-muted">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-inset hover:text-text-primary"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex flex-col p-2">
              {LINKS.map((l) => {
                const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "rounded-md px-3 py-2 text-[14px] transition-colors",
                      active
                        ? "bg-[var(--color-brand-soft)]/30 font-medium text-[var(--brand)]"
                        : "text-text-primary hover:bg-surface-inset",
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
