import { describe, expect, test } from 'bun:test';
import { FixedWindowRateLimiter, RedisRateLimiter } from './rate-limit';
import { MockRedisService, type RedisConnection } from './redis';

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

describe('RedisRateLimiter (legacy mock compatibility)', () => {
	function createMockRedis(): RedisConnection & { calls: string[][] } {
		const state = new Map<string, { value: string; expiresAt: number }>();
		const calls: string[][] = [];
		return {
			calls,
			connected: true,
			isConnected: true,
			close() {},
			get: async () => null,
			set: async () => 'OK',
			del: async () => 0,
			exists: async () => 0,
			expire: async () => 1,
			ttl: async () => -1,
			incr: async () => 1,
			incrWithExpire: async (key: string, ttl: number) => {
				const existing = state.get(key);
				const now = Date.now();
				if (!existing || now > existing.expiresAt) {
					state.set(key, { value: '1', expiresAt: now + ttl * 1000 });
					return 1;
				}
				const next = Number(existing.value) + 1;
				existing.value = String(next);
				return next;
			},
			eval: async () => 1,
			publish: async () => 0,
			subscribe: async () => async () => {},
			unsubscribe: async () => {},
			async send(...args: (string | number | (string | number)[])[]) {
				const flat = args.flat().map(String);
				calls.push(flat);
				const [cmd, ...rest] = flat;
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
				const parts = line.split(' ').filter(Boolean);
				return String(await this.send(parts[0] ?? '', ...parts.slice(1)));
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
		redis.incrWithExpire = async () => {
			throw new Error('Connection refused');
		};
		redis.send = async () => {
			throw new Error('Connection refused');
		};
		const limiter = new RedisRateLimiter(redis, 60_000, 1);
		const result = await limiter.check('k');
		expect(result.allowed).toBe(true);
	});
});

describe('RedisRateLimiter with MockRedisService (atomic operations & TTL safety)', () => {
	test('uses atomic incrWithExpire and sets TTL on creation to prevent leakage', async () => {
		const redis = new MockRedisService();
		let simulatedNow = 1_000_000;
		const limiter = new RedisRateLimiter(redis, 60_000, 3, { now: () => simulatedNow });

		// First check sets atomic TTL
		const res1 = await limiter.check('client:42');
		expect(res1.allowed).toBe(true);

		const windowKey = `ratelimit:client:42:${Math.floor(simulatedNow / 60_000)}`;
		// Confirm key exists and has TTL set immediately (prevents TTL leakage)
		const ttl = await redis.ttl(windowKey);
		expect(ttl).toBeGreaterThan(0);

		// Subsequent checks within limit
		expect((await limiter.check('client:42')).allowed).toBe(true);
		expect((await limiter.check('client:42')).allowed).toBe(true);

		// 4th check exceeds limit
		const blocked = await limiter.check('client:42');
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfterSeconds).toBe(20);

		// Advance window past resetAt
		simulatedNow += 20_000;
		const nextWindowRes = await limiter.check('client:42');
		expect(nextWindowRes.allowed).toBe(true);
	});

	test('independent keys do not interfere', async () => {
		const redis = new MockRedisService();
		const limiter = new RedisRateLimiter(redis, 60_000, 2);

		expect((await limiter.check('user:A')).allowed).toBe(true);
		expect((await limiter.check('user:A')).allowed).toBe(true);
		expect((await limiter.check('user:A')).allowed).toBe(false);

		expect((await limiter.check('user:B')).allowed).toBe(true);
		expect((await limiter.check('user:B')).allowed).toBe(true);
	});

	test('handles redis exceptions safely by falling back to allowed', async () => {
		const redis = new MockRedisService();
		redis.incrWithExpire = async () => {
			throw new Error('Redis node unavailable');
		};
		const limiter = new RedisRateLimiter(redis, 60_000, 5);

		const res = await limiter.check('fallback-test');
		expect(res.allowed).toBe(true);
		expect(res.retryAfterSeconds).toBe(0);
	});
});
