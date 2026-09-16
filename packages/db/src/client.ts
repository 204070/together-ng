import { env, loadEnv } from '@together/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

loadEnv();

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool;
let db: Db;

export function initDatabase(databaseUrl: string = env.DATABASE_URL): Db {
	pool = new Pool({ connectionString: databaseUrl, max: 10 });
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

export function createDb(databaseUrl: string = env.DATABASE_URL): Db {
	return initDatabase(databaseUrl);
}
