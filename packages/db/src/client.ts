import { env, loadEnv } from '@together/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

loadEnv();

export function createClient(databaseUrl: string = env.DATABASE_URL) {
	return postgres(databaseUrl, { max: 10, onnotice: () => {} });
}

export function createDb(databaseUrl: string = env.DATABASE_URL) {
	return drizzle(createClient(databaseUrl), { schema });
}

export type Sql = ReturnType<typeof createClient>;
export type Db = ReturnType<typeof createDb>;
