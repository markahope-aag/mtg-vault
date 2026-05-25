import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { CommandPaletteProvider } from "@/components/card-search/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { NavLink } from "@/components/nav-link";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";

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
    <CommandPaletteProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b border-border-subtle bg-surface-base/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-4 sm:gap-7">
              <Link
                href="/dashboard"
                className="inline-flex shrink-0 items-center gap-2 font-[var(--font-mono)] text-[13px] font-semibold uppercase tracking-[0.22em] text-[var(--text-primary)] hover:text-[var(--brand)] sm:text-[15px]"
              >
                <Logo size={22} className="text-[var(--brand)]" />
                <span className="hidden xs:inline">MTG · Vault</span>
              </Link>
              <nav className="hidden items-center gap-6 text-[14px] sm:flex">
                <NavLink href="/dashboard">Dashboard</NavLink>
                <NavLink href="/inventory">Inventory</NavLink>
                <NavLink href="/decks">Decks</NavLink>
                <NavLink href="/trades">Trades</NavLink>
                <NavLink href="/games">Games</NavLink>
                <NavLink href="/market">Market</NavLink>
                <NavLink href="/import">Import</NavLink>
                <NavLink href="/system">System</NavLink>
                <NavLink href="/help">Help</NavLink>
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs sm:gap-3">
              <kbd className="hidden rounded-sm border border-border-subtle bg-surface-inset px-1.5 py-0.5 font-mono text-[10px] text-text-muted sm:inline-block">
                ⌘K
              </kbd>
              <span className="hidden font-mono text-[11px] text-text-muted md:inline">
                {user.email}
              </span>
              <ThemeToggle />
              <LogoutButton />
              <MobileNav />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
      <Toaster />
    </CommandPaletteProvider>
  );
}
