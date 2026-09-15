import type { RedisConnection } from './redis';

export interface RateLimitDecision {
	allowed: boolean;
	retryAfterSeconds: number;
	resetAt: number;
}

interface Bucket {
	count: number;
	windowStart: number;
}

export interface Clock {
	now(): number;
}

const systemClock: Clock = { now: () => Date.now() };

export class FixedWindowRateLimiter {
	private readonly buckets = new Map<string, Bucket>();

	constructor(
		private readonly windowMs: number,
		private readonly maxHits: number,
		private readonly clock: Clock = systemClock,
	) {}

	check(key: string): RateLimitDecision {
		const now = this.clock.now();
		const bucket = this.buckets.get(key);
		if (bucket === undefined || now >= bucket.windowStart + this.windowMs) {
			this.buckets.set(key, { count: 1, windowStart: now });
			return { allowed: true, retryAfterSeconds: 0, resetAt: now + this.windowMs };
		}
		if (bucket.count < this.maxHits) {
			bucket.count += 1;
			return { allowed: true, retryAfterSeconds: 0, resetAt: bucket.windowStart + this.windowMs };
		}
		const resetAt = bucket.windowStart + this.windowMs;
		return {
			allowed: false,
			retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
			resetAt,
		};
	}
}

export class RedisRateLimiter {
	constructor(
		private readonly redis: RedisConnection,
		private readonly windowMs: number,
		private readonly maxHits: number,
	) {}

	async check(key: string): Promise<RateLimitDecision> {
		const now = Date.now();
		const windowKey = `ratelimit:${key}:${Math.floor(now / this.windowMs)}`;
		const ttlSeconds = Math.ceil(this.windowMs / 1000);

		try {
			const count = await this.redis.send('INCR', windowKey);
			if (Number(count) === 1) {
				await this.redis.send('EXPIRE', windowKey, String(ttlSeconds));
			}
			const currentCount = Number(count);
			const resetAt = (Math.floor(now / this.windowMs) + 1) * this.windowMs;
			if (currentCount > this.maxHits) {
				return {
					allowed: false,
					retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
					resetAt,
				};
			}
			return { allowed: true, retryAfterSeconds: 0, resetAt };
		} catch {
			return {
				allowed: true,
				retryAfterSeconds: 0,
				resetAt: now + this.windowMs,
			};
		}
	}
}
