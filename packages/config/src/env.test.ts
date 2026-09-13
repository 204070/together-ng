import { describe, expect, test } from 'bun:test';

const VALID = {
	DATABASE_URL: 'postgresql://together:together@localhost:5432/together',
	JWT_SECRET: 'test-secret',
};

let counter = 0;

async function freshConfig() {
	const mod = await import(`../src/env.ts?case=${counter}`);
	counter += 1;
	return mod as typeof import('../src/env');
}

describe('@together/config env', () => {
	test('importing the module is side-effect-free: env is undefined until loadEnv()', async () => {
		const mod = await freshConfig();
		expect(mod.env).toBeUndefined();
	});

	test('loadEnv applies defaults when optional vars are absent', async () => {
		const mod = await freshConfig();
		const parsed = mod.loadEnv({ ...VALID });
		expect(parsed.PORT).toBe(4000);
		expect(parsed.WEB_PORT).toBe(5000);
		expect(parsed.ADMIN_PORT).toBe(5100);
		expect(parsed.NODE_ENV).toBe('development');
		expect(parsed.OTP_PROVIDER).toBe('mock');
		expect(parsed.TERMII_API_KEY).toBe('');
		expect(parsed.TERMII_SENDER_ID).toBe('');
	});

	test('loadEnv coerces integer vars with Number() and accepts valid overrides', async () => {
		const mod = await freshConfig();
		const parsed = mod.loadEnv({
			...VALID,
			PORT: '4004',
			WEB_PORT: '5028',
			ADMIN_PORT: '5128',
			NODE_ENV: 'test',
			OTP_PROVIDER: 'termii',
		});
		expect(parsed.PORT).toBe(4004);
		expect(parsed.WEB_PORT).toBe(5028);
		expect(parsed.ADMIN_PORT).toBe(5128);
		expect(parsed.NODE_ENV).toBe('test');
		expect(parsed.OTP_PROVIDER).toBe('termii');
	});

	test('missing DATABASE_URL throws with var name, "required", and no default', async () => {
		const mod = await freshConfig();
		expect(() => mod.loadEnv({ JWT_SECRET: 's' })).toThrow(/DATABASE_URL/);
		try {
			mod.loadEnv({ JWT_SECRET: 's' });
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain('DATABASE_URL');
			expect(message).toContain('required');
			expect(message).toContain('(none)');
		}
	});

	test('missing JWT_SECRET throws with var name, "required", and no default', async () => {
		const mod = await freshConfig();
		expect(() => mod.loadEnv({ DATABASE_URL: 'postgres://x' })).toThrow(/JWT_SECRET/);
		try {
			mod.loadEnv({ DATABASE_URL: 'postgres://x' });
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain('JWT_SECRET');
			expect(message).toContain('required');
			expect(message).toContain('(none)');
		}
	});

	test('empty DATABASE_URL throws with "too short" and no default', async () => {
		const mod = await freshConfig();
		try {
			mod.loadEnv({ ...VALID, DATABASE_URL: '' });
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain('DATABASE_URL');
			expect(message).toContain('too short');
			expect(message).toContain('(none)');
		}
	});

	test('OTP_PROVIDER=smtp throws as "not a declared literal" and names the default mock', async () => {
		const mod = await freshConfig();
		try {
			mod.loadEnv({ ...VALID, OTP_PROVIDER: 'smtp' });
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain('OTP_PROVIDER');
			expect(message).toContain('not a declared literal');
			expect(message).toContain('mock');
		}
	});

	test('PORT=abc throws with "wrong type" and names the default 4000', async () => {
		const mod = await freshConfig();
		try {
			mod.loadEnv({ ...VALID, PORT: 'abc' });
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain('PORT');
			expect(message).toContain('wrong type');
			expect(message).toContain('4000');
		}
	});

	test('PORT=4000.5 throws with "wrong type" and names the default 4000', async () => {
		const mod = await freshConfig();
		try {
			mod.loadEnv({ ...VALID, PORT: '4000.5' });
		} catch (error) {
			const message = (error as Error).message;
			expect(message).toContain('PORT');
			expect(message).toContain('wrong type');
			expect(message).toContain('4000');
		}
	});

	test('loadEnv is idempotent: repeated calls return the same instance', async () => {
		const mod = await freshConfig();
		const first = mod.loadEnv({ ...VALID });
		const second = mod.loadEnv();
		expect(second).toBe(first);
	});

	test('env is frozen', async () => {
		const mod = await freshConfig();
		mod.loadEnv({ ...VALID });
		expect(Object.isFrozen(mod.env)).toBe(true);
	});

	test('PINNED_VARS equals the D6 set exactly', async () => {
		const mod = await freshConfig();
		expect([...mod.PINNED_VARS]).toEqual([
			'DATABASE_URL',
			'TEST_DATABASE_URL',
			'PORT',
			'WEB_PORT',
			'ADMIN_PORT',
		]);
	});

	test('loadEnv() with no argument reads the real process env (dotenv + ambient) and validates', async () => {
		const mod = await freshConfig();
		expect(() => mod.loadEnv()).not.toThrow();
		expect(mod.env).toBeDefined();
		expect(Object.keys(mod.env)).toEqual(
			expect.arrayContaining([
				'PORT',
				'WEB_PORT',
				'ADMIN_PORT',
				'NODE_ENV',
				'OTP_PROVIDER',
				'DATABASE_URL',
				'JWT_SECRET',
				'TERMII_API_KEY',
				'TERMII_SENDER_ID',
			]),
		);
	});
});
