/**
 * Public API for @aisentinels/db.
 * Re-exports the Drizzle client factory and shared types.
 *
 * Usage:
 *   import { createDb } from '@aisentinels/db';
 *   const { db, client } = await createDb({ iamAuth: true });
 */
export { createDb, getDb } from './db.ts';
export type { Db, DbConfig } from './db.ts';
