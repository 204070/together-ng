import { describe, expect, test } from 'bun:test';
import { FixedWindowRateLimiter, RedisRateLimiter } from './rate-limit';
import type { RedisConnection } from './redis';

describe('FixedWindowRateLimiter', () => {
	test('allows up to maxHits within a window, then blocks with retry info', () => {
		const now = 1_000_000;
		const limiter = new FixedWindowRateLimiter(60_000, 10, { now: () => now });

		for (let i = 0; i < 10; i += 1) {
			expect(limiter.check('k').allowed).toBe(true);
		}
		const blocked = limiter.check('k');
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfterSeconds).toBe(60);
		expect(blocked.resetAt).toBe(1_060_000);
	});

	test('resets after the window elapses', () => {
		let now = 1_000_000;
		const limiter = new FixedWindowRateLimiter(60_000, 2, { now: () => now });

		limiter.check('k');
		limiter.check('k');
		expect(limiter.check('k').allowed).toBe(false);

		now = 1_060_000;
		expect(limiter.check('k').allowed).toBe(true);
	});

	test('keys are independent', () => {
		const limiter = new FixedWindowRateLimiter(60_000, 1, { now: () => 1_000_000 });

		expect(limiter.check('a').allowed).toBe(true);
		expect(limiter.check('a').allowed).toBe(false);
		expect(limiter.check('b').allowed).toBe(true);
	});

	test('retryAfterSeconds is at least 1 even for microsecond windows', () => {
		const limiter = new FixedWindowRateLimiter(1, 1, { now: () => 1_000_000 });
		limiter.check('k');
		const blocked = limiter.check('k');
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
	});

	test('uses the system clock by default', () => {
		const limiter = new FixedWindowRateLimiter(60_000, 1);
		expect(limiter.check('default').allowed).toBe(true);
		expect(limiter.check('default').allowed).toBe(false);
	});
});

describe('RedisRateLimiter', () => {
	function createMockRedis(): RedisConnection & { calls: string[][] } {
		const state = new Map<string, { value: string; expiresAt: number }>();
		const calls: string[][] = [];
		return {
			calls,
			connected: true,
			close() {},
			async send(...args: string[]) {
				calls.push(args);
				const [cmd, ...rest] = args;
				if (cmd === 'INCR') {
					const key = rest[0] ?? '';
					const existing = state.get(key);
					const now = Date.now();
					if (!existing || now > existing.expiresAt) {
						state.set(key, { value: '1', expiresAt: now + 60_000 });
						return '1';
					}
					const newVal = String(Number(existing.value) + 1);
					existing.value = newVal;
					return newVal;
				}
				if (cmd === 'EXPIRE') {
					const key = rest[0] ?? '';
					const ttl = Number(rest[1] ?? 0);
					const existing = state.get(key);
					if (existing) existing.expiresAt = Date.now() + ttl * 1000;
					return '1';
				}
				return '0';
			},
			async sendRaw(line: string) {
				return this.send(...line.split(' ').filter(Boolean));
			},
		};
	}

	test('allows requests within limit', async () => {
		const redis = createMockRedis();
		const limiter = new RedisRateLimiter(redis, 60_000, 5);

		for (let i = 0; i < 5; i++) {
			const result = await limiter.check('user:1');
			expect(result.allowed).toBe(true);
		}
	});

	test('blocks requests over limit', async () => {
		const redis = createMockRedis();
		const limiter = new RedisRateLimiter(redis, 60_000, 3);

		await limiter.check('user:1');
		await limiter.check('user:1');
		await limiter.check('user:1');
		const blocked = await limiter.check('user:1');
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
	});

	test('different keys are independent', async () => {
		const redis = createMockRedis();
		const limiter = new RedisRateLimiter(redis, 60_000, 1);

		await limiter.check('a');
		const blockedA = await limiter.check('a');
		expect(blockedA.allowed).toBe(false);

		const allowedB = await limiter.check('b');
		expect(allowedB.allowed).toBe(true);
	});

	test('falls back to allowed on Redis error', async () => {
		const redis = createMockRedis();
		redis.send = async () => {
			throw new Error('Connection refused');
		};
		const limiter = new RedisRateLimiter(redis, 60_000, 1);
		const result = await limiter.check('k');
		expect(result.allowed).toBe(true);
	});
});
