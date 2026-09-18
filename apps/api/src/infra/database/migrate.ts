import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { getApiConfig } from '../../lib/config';

export const migrationsDir = resolve(import.meta.dir, './migrations');

export async function migrate(databaseUrl?: string): Promise<void> {
	const url = databaseUrl ?? getApiConfig().database.url;
	const pool = new Pool({ connectionString: url, max: 1 });
	try {
		const db = drizzle(pool);
		await drizzleMigrate(db, { migrationsFolder: migrationsDir });
	} finally {
		await pool.end();
	}
}

if (import.meta.main) {
	await migrate();
	console.log('database schema is up to date');
}
