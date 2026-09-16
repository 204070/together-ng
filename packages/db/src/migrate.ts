import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env, loadEnv } from '@together/config';
import { Pool } from 'pg';

loadEnv();

export const migrationsDir = resolve(import.meta.dir, '../drizzle');

function splitStatements(content: string): string[] {
	return content
		.split('--> statement-breakpoint')
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

export async function migrate(databaseUrl: string = env.DATABASE_URL): Promise<void> {
	const pool = new Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	try {
		await client.query(`
			CREATE TABLE IF NOT EXISTS public.drizzle_migrations (
				id bigint generated always as identity primary key,
				file_name text not null unique,
				hash text not null,
				applied_at timestamptz not null default now()
			)
		`);

		const result = await client.query<{ file_name: string }>(
			'SELECT file_name FROM public.drizzle_migrations',
		);
		const applied = new Set(result.rows.map((row) => row.file_name));

		const files = readdirSync(migrationsDir)
			.filter((file) => file.endsWith('.sql'))
			.sort();

		let appliedCount = 0;
		for (const file of files) {
			if (applied.has(file)) continue;
			const content = readFileSync(resolve(migrationsDir, file), 'utf8');
			const hash = createHash('sha256').update(content).digest('hex');
			await client.query('BEGIN');
			try {
				for (const statement of splitStatements(content)) {
					await client.query(statement);
				}
				await client.query(
					'INSERT INTO public.drizzle_migrations (file_name, hash) VALUES ($1, $2)',
					[file, hash],
				);
				await client.query('COMMIT');
			} catch (err) {
				await client.query('ROLLBACK');
				throw err;
			}
			appliedCount += 1;
			console.log(`applied migration ${file}`);
		}
		console.log(`drizzle_migrations applied: ${appliedCount + applied.size}, new: ${appliedCount}`);
	} finally {
		client.release();
		await pool.end();
	}
}

if (import.meta.main) {
	await migrate();
	console.log('database schema is up to date');
}
