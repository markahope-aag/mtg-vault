import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely coerce a value returned from a raw db.execute() into an ISO string.
 *
 * The postgres-js driver returns `timestamp without time zone` columns as
 * strings (e.g. "2026-05-21 00:48:20.755745") and `timestamp with time zone`
 * as Date objects. Drizzle's typed schema doesn't surface this distinction at
 * runtime when you use raw SQL — calling `.toISOString()` on a string crashes
 * the request with a TypeError.
 *
 * Use this helper everywhere a raw-SQL result row exposes a timestamp.
 */
export function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString();
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}
