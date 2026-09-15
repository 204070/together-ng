import { env as configEnv } from '@together/config';
import { createClient, type Sql } from '@together/db';
import { FixedWindowRateLimiter } from '../../lib/rate-limit';
import type { MatchingService } from '../../worker/matching';
import type { AuthStore } from '../auth/store';
import { RequestStore } from './store';

export const REQUEST_WINDOW_MS = 60_000;
export const REQUEST_MAX_HITS = 20;

export interface RequestEnv {
	databaseUrl?: string;
	jwtSecret?: string;
	sql?: Sql;
	now?: () => Date;
}

export interface RequestServices {
	sql: Sql;
	store: RequestStore;
	limiter: FixedWindowRateLimiter;
	jwtSecret: string;
	now: () => Date;
	matching: MatchingService | undefined;
	findUserById: (id: string) => Promise<{ status: string; deleted_at: Date | null } | undefined>;
	close: () => Promise<void>;
}

export function createRequestServices(
	env: RequestEnv = {},
	deps: {
		sql?: Sql;
		authStore?: AuthStore;
		now?: () => Date;
		limiter?: FixedWindowRateLimiter;
		matching?: MatchingService;
	} = {},
): RequestServices {
	const databaseUrl = env.databaseUrl ?? configEnv.DATABASE_URL;
	const jwtSecret = env.jwtSecret ?? configEnv.JWT_SECRET;
	const now = deps.now ?? env.now ?? (() => new Date());
	const sql = (deps.sql ?? env.sql ?? createClient(databaseUrl)) as Sql;
	const store = new RequestStore(sql);
	const limiter =
		deps.limiter ??
		new FixedWindowRateLimiter(REQUEST_WINDOW_MS, REQUEST_MAX_HITS, {
			now: () => now().getTime(),
		});

	const findUserById = async (id: string) => {
		if (deps.authStore) {
			return deps.authStore.findUserById(id);
		}
		const rows = await sql<{ status: string; deleted_at: Date | null }[]>`
			SELECT status, deleted_at FROM users WHERE id = ${id}
		`;
		return rows[0];
	};

	return {
		sql,
		store,
		limiter,
		jwtSecret,
		now,
		matching: deps.matching,
		findUserById,
		close: () => (env.sql === undefined && deps.sql === undefined ? sql.end() : Promise.resolve()),
	};
}
