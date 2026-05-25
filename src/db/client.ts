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
  const client = postgres(connectionString, {
    prepare: false,
    // Belt-and-suspenders on top of the role-level ALTER ROLE
    // ... SET search_path. pg_trgm moved out of public into the
    // `extensions` schema (DB lint 0009_extension_in_public_schema),
    // so the unqualified `%` operator + `similarity()` calls
    // sprinkled across inventory/search SQL need extensions in
    // search_path on every connection — fresh warm functions on
    // Vercel won't pick up the role-level setting until they cycle.
    // Setting it per-connection here makes the rollout instant.
    connection: {
      search_path: '"$user", public, extensions',
    },
  });
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
