import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { CommandPaletteProvider } from "@/components/card-search/command-palette";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";

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
      <div className="flex min-h-screen flex-col">
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-5">
              <Link
                href="/dashboard"
                className="text-sm font-semibold tracking-tight"
              >
                MTG Vault
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link
                  href="/inventory"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Inventory
                </Link>
                <Link
                  href="/decks"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Decks
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline-block">
                ⌘K
              </kbd>
              <span className="text-muted-foreground">{user.email}</span>
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
