import { env, loadEnv } from '@together/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

loadEnv();

export function createClient(databaseUrl: string = env.DATABASE_URL) {
	return postgres(databaseUrl, { max: 10, onnotice: () => {} });
}

export function createDb(databaseUrl: string = env.DATABASE_URL) {
	return drizzle(createClient(databaseUrl));
}

export type Sql = ReturnType<typeof createClient>;
