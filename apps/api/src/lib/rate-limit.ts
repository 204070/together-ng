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
