import { env as configEnv } from '@together/config';
import { createClient, type Sql } from '@together/db';
import { type PhotoStorage, photoStorage } from '../../lib/storage';
import { ProfileStore } from './store';

export interface ProfileEnv {
	databaseUrl?: string;
	jwtSecret?: string;
	sql?: Sql;
	storage?: PhotoStorage;
}

export interface ProfileServices {
	sql: Sql;
	store: ProfileStore;
	storage: PhotoStorage;
	jwtSecret: string;
	close: () => Promise<void>;
}

export function createProfileServices(
	env: ProfileEnv = {},
	deps: { sql?: Sql; storage?: PhotoStorage } = {},
): ProfileServices {
	const databaseUrl = env.databaseUrl ?? configEnv.DATABASE_URL;
	const jwtSecret = env.jwtSecret ?? configEnv.JWT_SECRET;
	const sql = (deps.sql ?? env.sql ?? createClient(databaseUrl)) as Sql;
	const store = new ProfileStore(sql);
	const storage = deps.storage ?? env.storage ?? photoStorage;

	return {
		sql,
		store,
		storage,
		jwtSecret,
		close: () => (env.sql === undefined && deps.sql === undefined ? sql.end() : Promise.resolve()),
	};
}
