import { env as configEnv } from '@together/config';
import { createDb, getPool, type Db, eq, users } from '@together/db';
import {
	FixedWindowRateLimiter,
	type RateLimitDecision,
	RedisRateLimiter,
} from '../../lib/rate-limit';
import { createRedisConnection, type RedisConnection } from '../../lib/redis';
import type { MatchingService } from '../../worker/matching';
import type { AuthStore } from '../auth/store';
import { RequestStore } from './store';

export const REQUEST_WINDOW_MS = 60_000;
export const REQUEST_MAX_HITS = 20;

export interface RequestEnv {
	databaseUrl?: string;
	jwtSecret?: string;
	db?: Db;
	now?: () => Date;
	redisUrl?: string;
}

export interface AsyncRateLimiter {
	check(key: string): Promise<RateLimitDecision>;
}

export interface RequestServices {
	db: Db;
	store: RequestStore;
	limiter: AsyncRateLimiter;
	jwtSecret: string;
	now: () => Date;
	matching: MatchingService | undefined;
	findUserById: (id: string) => Promise<{ status: string; deletedAt: Date | null } | undefined>;
	close: () => Promise<void>;
}

export function createRequestServices(
	env: RequestEnv = {},
	deps: {
		db?: Db;
		authStore?: AuthStore;
		now?: () => Date;
		limiter?: AsyncRateLimiter;
		matching?: MatchingService;
		redis?: RedisConnection | null;
	} = {},
): RequestServices {
	const databaseUrl = env.databaseUrl ?? configEnv.DATABASE_URL;
	const jwtSecret = env.jwtSecret ?? configEnv.JWT_SECRET;
	const now = deps.now ?? env.now ?? (() => new Date());
	const db = deps.db ?? env.db ?? createDb(databaseUrl);
	const store = new RequestStore(db);

	let limiter: AsyncRateLimiter;
	if (deps.limiter) {
		limiter = deps.limiter;
	} else {
		const memoryLimiter = new FixedWindowRateLimiter(REQUEST_WINDOW_MS, REQUEST_MAX_HITS, {
			now: () => now().getTime(),
		});
		limiter = {
			check: (key: string) => Promise.resolve(memoryLimiter.check(key)),
		};

		const redisUrl = env.redisUrl ?? configEnv.REDIS_URL;
		if (redisUrl) {
			createRedisConnection(redisUrl)
				.then((redis) => {
					limiter = new RedisRateLimiter(redis, REQUEST_WINDOW_MS, REQUEST_MAX_HITS);
				})
				.catch(() => {
					// Redis unavailable, keep using in-memory limiter
				});
		}
	}

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
		limiter,
		jwtSecret,
		now,
		matching: deps.matching,
		findUserById,
		close: () => (env.db === undefined && deps.db === undefined ? getPool().end() : Promise.resolve()),
	};
}
