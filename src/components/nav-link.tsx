"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "font-medium transition-colors",
        active
          ? "nav-active text-text-primary"
          : "text-text-secondary hover:text-text-primary",
      )}
    >
      {children}
    </Link>
  );
}
