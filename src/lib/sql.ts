import { sql } from "drizzle-orm";

/**
 * Build a Postgres `ARRAY[...]::T[]` literal from a JS array.
 *
 * Drizzle interpolates a plain JS array inside a `sql` template as a
 * parenthesised tuple — `($1, $2, …)` — which Postgres parses as an
 * anonymous record. Record values can't be cast to text[]/uuid[] and
 * can't be used with array operators (`&&`, `<@`, `= ANY`, `UNNEST`),
 * so those queries fail at runtime with "cannot cast type record".
 *
 * An explicit ARRAY[…] constructor binds each element as its own
 * parameter and produces a real array. Empty input yields
 * `ARRAY[]::T[]`, which is valid Postgres.
 */
export function sqlArray(values: readonly string[], cast: "text" | "uuid") {
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::${sql.raw(cast)}[]`;
}
