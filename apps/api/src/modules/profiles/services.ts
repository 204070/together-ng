import { env as configEnv } from '@together/config';
import { createDb, type Db, type Sql } from '@together/db';
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
	const db =
		deps.db ??
		env.db ??
		(deps.sql || env.sql ? createDb(deps.sql ?? env.sql) : createDb(databaseUrl));
	const store = new ProfileStore(db);
	const storage = deps.storage ?? env.storage ?? photoStorage;

	return {
		db,
		store,
		storage,
		users: deps.users,
		jwtSecret,
		close: () =>
			env.sql === undefined &&
			deps.sql === undefined &&
			env.db === undefined &&
			deps.db === undefined
				? db.$client.end()
				: Promise.resolve(),
	};
}
