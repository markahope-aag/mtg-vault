import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { CommandPaletteProvider } from "@/components/card-search/command-palette";
import { QueryProvider } from "@/components/query-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { NavLink } from "@/components/nav-link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <QueryProvider>
      <CommandPaletteProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <header className="border-b border-border-subtle bg-surface-base/85 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
              <div className="flex items-center gap-7">
                <Link
                  href="/dashboard"
                  className="font-[var(--font-mono)] text-[15px] font-semibold uppercase tracking-[0.22em] text-[var(--text-primary)] hover:text-[var(--brand)]"
                >
                  MTG · Vault
                </Link>
                <nav className="flex items-center gap-6 text-[14px]">
                  <NavLink href="/dashboard">Dashboard</NavLink>
                  <NavLink href="/inventory">Inventory</NavLink>
                  <NavLink href="/decks">Decks</NavLink>
                  <NavLink href="/import">Import</NavLink>
                  <NavLink href="/system">System</NavLink>
                  <NavLink href="/help">Help</NavLink>
                </nav>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <kbd className="hidden rounded-sm border border-border-subtle bg-surface-inset px-1.5 py-0.5 font-mono text-[10px] text-text-muted sm:inline-block">
                  ⌘K
                </kbd>
                <span className="hidden font-mono text-[11px] text-text-muted sm:inline">
                  {user.email}
                </span>
                <ThemeToggle />
                <LogoutButton />
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
      </CommandPaletteProvider>
    </QueryProvider>
  );
}

