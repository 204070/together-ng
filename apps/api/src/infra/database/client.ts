import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getApiConfig } from '../../lib/config';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool;
let db: Db;

export function initDatabase(databaseUrl?: string): Db {
	const url = databaseUrl ?? getApiConfig().database.url;
	pool = new Pool({ connectionString: url, max: 10 });
	db = drizzle(pool, { schema }) as unknown as Db;
	return db;
}

export function getDatabase(): Db {
	if (!db) throw new Error('Database not initialized');
	return db;
}

export function getPool(): Pool {
	if (!pool) throw new Error('Database not initialized');
	return pool;
}

export function setDatabase(newDb: Db) {
	db = newDb;
}

export function createDb(databaseUrl?: string): Db {
	return initDatabase(databaseUrl);
}
