/**
 * Drizzle transaction wrapper that sets the PostgreSQL RLS tenant context.
 *
 * CRITICAL — set_config third argument MUST be `true` (transaction-local):
 *   `true`  = SET LOCAL — scoped to the current transaction only.
 *   `false` = SET SESSION — persists for the connection lifetime.
 *
 * Using `false` would leak tenant data across RDS Proxy connection pool
 * connections: connection A sets tenant X, returns to pool, connection B
 * picks it up and reads tenant X's data as a different tenant.
 *
 * CRITICAL — re-wrap txSql in a new drizzle() instance:
 *   All Drizzle ORM queries in `fn` must run on the same connection as
 *   the SET LOCAL call. Without re-wrapping, Drizzle uses the connection
 *   pool and the SET LOCAL context is lost.
 *
 * Usage:
 *   const { client } = await createDb({ iamAuth: true });
 *   await withTenantContext(client, tenantId, async (txDb) => {
 *     await txDb.insert(users).values({ tenantId, ... });
 *   });
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import * as schema from '@aisentinels/db/schema';
import type { Db } from '@aisentinels/db';

export async function withTenantContext<T>(
  sql: postgres.Sql,
  tenantId: string,
  fn: (txDb: Db) => Promise<T>,
): Promise<T> {
  // TransactionSql<{}> extends Sql but TypeScript doesn't recognise its call
  // signature or constructor properties. Cast to Sql to satisfy drizzle() and
  // the tagged-template call below. The cast is safe: TransactionSql IS Sql
  // at runtime — it just has a narrower TypeScript type.
  return sql.begin(async (txSql) => {
    const tx = txSql as unknown as postgres.Sql;

    // true = transaction-local (SET LOCAL) — never leaks across RDS Proxy pool connections
    await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

    // Re-wrap tx in a new Drizzle instance bound to this transaction connection.
    // Critical: without this, Drizzle would acquire a different connection from the
    // pool and the SET LOCAL context would not apply to subsequent queries.
    const txDb = drizzle(tx, { schema }) as Db;

    return fn(txDb);
  }) as Promise<T>;
}
