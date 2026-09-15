import { env, loadEnv } from '@together/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

loadEnv();

export function createClient(databaseUrl: string = env.DATABASE_URL) {
	return postgres(databaseUrl, { max: 10, onnotice: () => {} });
}

export type Sql = ReturnType<typeof createClient>;

export function createDb(clientOrUrl: Sql | string = env.DATABASE_URL) {
	const client = typeof clientOrUrl === 'string' ? createClient(clientOrUrl) : clientOrUrl;
	const db = drizzle(client, { schema });
	const dateSerializer = (val: unknown) => (val instanceof Date ? val.toISOString() : val);
	const jsonSerializer = (val: unknown) => (typeof val === 'string' ? val : JSON.stringify(val));
	const serializers = client.options.serializers as Record<string, (val: unknown) => unknown>;
	for (const type of ['1184', '1082', '1083', '1114', '1182', '1185', '1115', '1231']) {
		serializers[type] = dateSerializer;
	}
	serializers['114'] = jsonSerializer;
	serializers['3802'] = jsonSerializer;
	const dateParser = (val: string) => new Date(val);
	const parsers = client.options.parsers as Record<string, (val: string) => unknown>;
	for (const type of ['1184', '1082', '1114']) {
		parsers[type] = dateParser;
	}
	return db;
}

export type Db = ReturnType<typeof createDb>;
