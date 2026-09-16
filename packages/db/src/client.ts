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
	if (typeof clientOrUrl === 'string') {
		return drizzle(createClient(clientOrUrl), { schema });
	}
	const pass = clientOrUrl.options.pass;
	const client = postgres({
		host: clientOrUrl.options.host?.[0],
		port: clientOrUrl.options.port?.[0],
		path: clientOrUrl.options.path,
		database: clientOrUrl.options.database,
		username: clientOrUrl.options.user,
		...(pass !== null && pass !== undefined ? { password: pass } : {}),
		ssl: clientOrUrl.options.ssl,
		max: 10,
		onnotice: () => {},
	});
	return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
