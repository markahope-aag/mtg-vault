import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { CommandPaletteProvider } from "@/components/card-search/command-palette";

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
      <div className="flex min-h-screen flex-col">
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
            <Link
              href="/dashboard"
              className="text-sm font-semibold tracking-tight"
            >
              MTG Vault
            </Link>
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
    </CommandPaletteProvider>
  );
}
