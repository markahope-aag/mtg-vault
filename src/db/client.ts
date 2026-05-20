import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | undefined;

function initDb(): Db {
  if (cached) return cached;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  // Strip surrounding quotes if a dashboard/CI paste included them.
  const connectionString = raw.replace(/^["']|["']$/g, "");
  const client = postgres(connectionString, { prepare: false });
  cached = drizzle(client, { schema });
  return cached;
}

// Lazy-evaluated proxy so importing this module never opens a connection or
// validates env vars at build time (Next.js collects page data eagerly).
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    return (initDb() as unknown as Record<PropertyKey, unknown>)[prop];
  },
}) as Db;
