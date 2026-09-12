import { describe, expect, test } from 'bun:test';
import { FixedWindowRateLimiter } from './rate-limit';

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
