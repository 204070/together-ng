import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDir = resolve(import.meta.dir, '../drizzle');

const EXTENSIONS = ['vector', 'pg_trgm'];

const files = readdirSync(migrationsDir)
	.filter((file) => file.endsWith('.sql'))
	.sort();

for (const file of files) {
	const path = resolve(migrationsDir, file);
	const content = readFileSync(path, 'utf8');
	const missing = EXTENSIONS.filter(
		(name) => !content.includes(`CREATE EXTENSION IF NOT EXISTS "${name}"`),
	);
	if (missing.length === 0) {
		console.log(`extensions already present in ${file}`);
		continue;
	}
	const header = missing
		.map((name) => `CREATE EXTENSION IF NOT EXISTS "${name}";`)
		.join('\n\n--> statement-breakpoint\n\n');
	writeFileSync(path, `${header}\n\n--> statement-breakpoint\n\n${content}`);
	console.log(`ensured extensions in ${file}: ${missing.join(', ')}`);
}

console.log('extension statements ensured in all migration files');
