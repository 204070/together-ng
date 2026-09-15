import { env as configEnv } from '@together/config';
import { createClient, createDb, type Db, type Sql } from '@together/db';
import type { ActiveUserLookup } from '../../lib/authentication';
import { type PhotoStorage, photoStorage } from '../../lib/storage';
import { ProfileStore } from './store';

export interface ProfileEnv {
	databaseUrl?: string;
	jwtSecret?: string;
	sql?: Sql;
	db?: Db;
	storage?: PhotoStorage;
}

export interface ProfileServices {
	sql: Sql;
	db: Db;
	store: ProfileStore;
	storage: PhotoStorage;
	users: ActiveUserLookup;
	jwtSecret: string;
	close: () => Promise<void>;
}

export function createProfileServices(
	env: ProfileEnv = {},
	deps: { users: ActiveUserLookup; sql?: Sql; db?: Db; storage?: PhotoStorage },
): ProfileServices {
	const databaseUrl = env.databaseUrl ?? configEnv.DATABASE_URL;
	const jwtSecret = env.jwtSecret ?? configEnv.JWT_SECRET;
	const sql = (deps.sql ?? env.sql ?? createClient(databaseUrl)) as Sql;
	const db = deps.db ?? env.db ?? createDb(databaseUrl);
	const store = new ProfileStore(db);
	const storage = deps.storage ?? env.storage ?? photoStorage;

	return {
		sql,
		db,
		store,
		storage,
		users: deps.users,
		jwtSecret,
		close: () => (env.sql === undefined && deps.sql === undefined ? sql.end() : Promise.resolve()),
	};
}
