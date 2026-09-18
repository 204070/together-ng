import { describe, expect, test } from 'bun:test';
import { loadEnv, resetCachedEnv } from './loadEnv';

const VALID = {
	DATABASE_URL: 'postgresql://together:together@localhost:5433/together_test',
	JWT_SECRET: 'test-jwt-secret-key-12345',
};

describe('apps/api loadEnv', () => {
	test('loadEnv applies default values when optional vars are omitted', () => {
		resetCachedEnv();
		const env = loadEnv({ ...VALID });
		expect(env.PORT).toBe(4000);
		expect(env.NODE_ENV).toBe('development');
		expect(env.OTP_PROVIDER).toBe('mock');
		expect(env.STORAGE_PROVIDER).toBe('mock');
		expect(env.STORAGE_BUCKET).toBe('together-uploads');
		expect(env.STORAGE_REGION).toBe('us-east-1');
		expect(env.REDIS_URL).toBe('');
		expect(env.TERMII_API_KEY).toBe('');
	});

	test('loadEnv coerces string PORT to number', () => {
		resetCachedEnv();
		const env = loadEnv({
			...VALID,
			PORT: '4050',
			NODE_ENV: 'test',
		});
		expect(env.PORT).toBe(4050);
		expect(env.NODE_ENV).toBe('test');
	});

	test('missing DATABASE_URL throws validation error', () => {
		resetCachedEnv();
		expect(() => loadEnv({ JWT_SECRET: 'secret' })).toThrow(/DATABASE_URL/);
	});

	test('missing JWT_SECRET throws validation error', () => {
		resetCachedEnv();
		expect(() => loadEnv({ DATABASE_URL: 'postgresql://localhost:5432/db' })).toThrow(/JWT_SECRET/);
	});
});
