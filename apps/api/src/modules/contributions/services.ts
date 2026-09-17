import { env as configEnv } from '@together/config';
import { createDb, type Db, eq, getPool, users } from '@together/db';
import type { AuthStore } from '../auth/store';
import { ContributionStore } from './store';

export interface ContributionEnv {
	databaseUrl?: string;
	jwtSecret?: string;
	db?: Db;
	now?: () => Date;
}

export interface ContributionServices {
	db: Db;
	store: ContributionStore;
	jwtSecret: string;
	now: () => Date;
	findUserById: (id: string) => Promise<{ status: string; deletedAt: Date | null } | undefined>;
	close: () => Promise<void>;
}

export function createContributionServices(
	env: ContributionEnv = {},
	deps: {
		db?: Db;
		authStore?: AuthStore;
		now?: () => Date;
	} = {},
): ContributionServices {
	const databaseUrl = env.databaseUrl ?? configEnv.DATABASE_URL;
	const jwtSecret = env.jwtSecret ?? configEnv.JWT_SECRET;
	const now = deps.now ?? env.now ?? (() => new Date());
	const db = deps.db ?? env.db ?? createDb(databaseUrl);
	const store = new ContributionStore(db);

	const findUserById = async (id: string) => {
		if (deps.authStore) {
			return deps.authStore.findUserById(id);
		}
		const rows = await db
			.select({ status: users.status, deletedAt: users.deletedAt })
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		return rows[0];
	};

	return {
		db,
		store,
		jwtSecret,
		now,
		findUserById,
		close: () =>
			env.db === undefined && deps.db === undefined ? getPool().end() : Promise.resolve(),
	};
}
