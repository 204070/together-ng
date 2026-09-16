import { resolve } from 'node:path';
import { env, loadEnv } from '@together/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

loadEnv();

export const migrationsDir = resolve(import.meta.dir, '../drizzle');

export async function migrate(databaseUrl: string = env.DATABASE_URL): Promise<void> {
	const pool = new Pool({ connectionString: databaseUrl, max: 1 });
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
