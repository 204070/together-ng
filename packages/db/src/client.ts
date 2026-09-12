import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadEnv } from './env';

loadEnv();

export function createClient(databaseUrl: string = process.env.DATABASE_URL ?? '') {
	return postgres(databaseUrl, { max: 10, onnotice: () => {} });
}

export function createDb(databaseUrl: string = process.env.DATABASE_URL ?? '') {
	return drizzle(createClient(databaseUrl));
}

export type Sql = ReturnType<typeof createClient>;
