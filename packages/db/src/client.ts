import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { env, loadEnv } from '@together/config';
import * as schema from './schema';

loadEnv();

let pool: Pool;
let db: NodePgDatabase<typeof schema>;

export function initDatabase(databaseUrl: string = env.DATABASE_URL) {
	pool = new Pool({ connectionString: databaseUrl, max: 10 });
	db = drizzle(pool, { schema });
	return db;
}

export function getDatabase() {
	if (!db) throw new Error('Database not initialized');
	return db;
}

export function getPool() {
	if (!pool) throw new Error('Database not initialized');
	return pool;
}

export function setDatabase(newDb: NodePgDatabase<typeof schema>) {
	db = newDb;
}

export function createDb(databaseUrl: string = env.DATABASE_URL) {
	return initDatabase(databaseUrl);
}

export type Db = NodePgDatabase<typeof schema>;
