import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { loadEnv } from './env';

loadEnv();

export const migrationsDir = resolve(import.meta.dir, '../drizzle');

function splitStatements(content: string): string[] {
	return content
		.split('--> statement-breakpoint')
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

export async function migrate(databaseUrl: string = process.env.DATABASE_URL ?? ''): Promise<void> {
	const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
	try {
		await sql`CREATE TABLE IF NOT EXISTS public.drizzle_migrations (
			id bigint generated always as identity primary key,
			file_name text not null unique,
			hash text not null,
			applied_at timestamptz not null default now()
		)`;

		const applied = new Set(
			(
				await sql<{ file_name: string }[]>`
					SELECT file_name FROM public.drizzle_migrations
				`
			).map((row) => row.file_name),
		);

		const files = readdirSync(migrationsDir)
			.filter((file) => file.endsWith('.sql'))
			.sort();

		let appliedCount = 0;
		for (const file of files) {
			if (applied.has(file)) continue;
			const content = readFileSync(resolve(migrationsDir, file), 'utf8');
			const hash = createHash('sha256').update(content).digest('hex');
			await sql.begin(async (tx) => {
				for (const statement of splitStatements(content)) {
					await tx.unsafe(statement);
				}
				await tx`INSERT INTO public.drizzle_migrations (file_name, hash) VALUES (${file}, ${hash})`;
			});
			appliedCount += 1;
			console.log(`applied migration ${file}`);
		}
		console.log(`drizzle_migrations applied: ${appliedCount + applied.size}, new: ${appliedCount}`);
	} finally {
		await sql.end();
	}
}

if (import.meta.main) {
	await migrate();
	console.log('database schema is up to date');
}
