"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small "back" affordance for subordinate pages. With href it's a real link;
 * without, it falls back to router.back() so the user returns wherever they
 * came from (deck card → /cards/[id] → back to the deckbuilder, etc.).
 */
export function BackLink({
  label = "Back",
  href,
  className,
}: {
  label?: string;
  href?: string;
  className?: string;
}) {
  const router = useRouter();
  const base =
    "inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-text-muted hover:text-text-primary transition-colors";
  if (href) {
    return (
      <Link href={href} className={cn(base, className)}>
        <ArrowLeft className="size-3.5" /> {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={cn(base, className)}
    >
      <ArrowLeft className="size-3.5" /> {label}
    </button>
  );
}
