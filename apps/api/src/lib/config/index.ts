import { type ApiEnv, loadEnv } from './loadEnv';

export interface DatabaseConfig {
	readonly url: string;
}

export interface RedisConfig {
	readonly url: string;
}

export interface AuthConfig {
	readonly jwtSecret: string;
	readonly loginWindowMs: number;
	readonly loginMaxHits: number;
	readonly otpSendWindowMs: number;
	readonly otpSendMaxHits: number;
	readonly otpVerifyWindowMs: number;
	readonly otpVerifyMaxHits: number;
}

export interface TermiiConfig {
	readonly apiKey: string;
	readonly senderId: string;
}

export interface OtpConfig {
	readonly provider: 'mock' | 'termii';
	readonly termii: TermiiConfig;
}

export interface StorageConfig {
	readonly provider: 'mock' | 's3';
	readonly bucket: string;
	readonly endpoint?: string;
	readonly accessKeyId?: string;
	readonly secretAccessKey?: string;
	readonly sessionToken?: string;
	readonly region: string;
	readonly publicUrl?: string;
}

export interface RequestsConfig {
	readonly windowMs: number;
	readonly maxHits: number;
	readonly featuredCacheTtlSeconds: number;
}

export interface ApiConfig {
	readonly env: 'development' | 'production' | 'test';
	readonly isProduction: boolean;
	readonly isTest: boolean;
	readonly port: number;
	readonly database: DatabaseConfig;
	readonly redis: RedisConfig;
	readonly auth: AuthConfig;
	readonly otp: OtpConfig;
	readonly storage: StorageConfig;
	readonly requests: RequestsConfig;
	readonly databaseUrl: string;
	readonly redisUrl: string;
	readonly jwtSecret: string;
}

/**
 * Builds a fresh, strongly-typed `ApiConfig` object tree from validated environment variables
 * and deterministic application defaults.
 *
 * This function is pure and has no side-effects; it does not mutate the active singleton config.
 *
 * @param env Optional pre-validated environment object. Defaults to invoking `loadEnv()`.
 * @returns An immutable `ApiConfig` instance.
 */
export function buildConfig(env: ApiEnv = loadEnv()): ApiConfig {
	return {
		env: env.NODE_ENV,
		isProduction: env.NODE_ENV === 'production',
		isTest: env.NODE_ENV === 'test',
		port: env.PORT,
		databaseUrl: env.DATABASE_URL,
		redisUrl: env.REDIS_URL || 'redis://localhost:6380/0',
		jwtSecret: env.JWT_SECRET,
		database: {
			url: env.DATABASE_URL,
		},
		redis: {
			url: env.REDIS_URL || 'redis://localhost:6380/0',
		},
		auth: {
			jwtSecret: env.JWT_SECRET,
			loginWindowMs: 60_000,
			loginMaxHits: 10,
			otpSendWindowMs: 60_000,
			otpSendMaxHits: 1,
			otpVerifyWindowMs: 60_000,
			otpVerifyMaxHits: 10,
		},
		otp: {
			provider: env.OTP_PROVIDER,
			termii: {
				apiKey: env.TERMII_API_KEY,
				senderId: env.TERMII_SENDER_ID,
			},
		},
		storage: {
			provider: env.STORAGE_PROVIDER,
			bucket: env.STORAGE_BUCKET,
			endpoint: env.STORAGE_ENDPOINT || undefined,
			accessKeyId: env.STORAGE_ACCESS_KEY_ID || undefined,
			secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY || undefined,
			region: env.STORAGE_REGION,
			publicUrl: env.STORAGE_PUBLIC_URL || undefined,
		},
		requests: {
			windowMs: 60_000,
			maxHits: 20,
			featuredCacheTtlSeconds: 30,
		},
	};
}

let activeConfig: ApiConfig = buildConfig();

/**
 * Retrieves the currently active `ApiConfig` instance.
 *
 * Used throughout application code (routes, services, workers, and infrastructure clients)
 * to access compiler-verified configuration values and domain groupings without reading `process.env`.
 *
 * @returns The active `ApiConfig` singleton.
 */
export function getApiConfig(): ApiConfig {
	return activeConfig;
}

/**
 * Overrides specific configuration properties for testing purposes.
 *
 * Deeply merges domain-level sub-objects (`auth`, `otp`, `storage`, `database`, `redis`, `requests`)
 * so callers can override only the subset of keys relevant to their test.
 *
 * ### Parallel Testing & Isolation Guarantees:
 * - **Across Test Files**: In Bun (`bun test`), each test file runs in its own isolated worker process/thread.
 *   Module-level variables like `activeConfig` are NOT shared between test files. Test file A calling
 *   `setTestConfig()` will not affect test file B running in parallel.
 * - **Within a Test File (Sequential)**: Tests within a file execute sequentially by default.
 *   Calling `setTestConfig()` in `beforeEach()` / inside a test and calling `resetTestConfig()`
 *   in `afterEach()` / `finally` is completely safe.
 * - **Within a Test File (Concurrent)**: If tests within the *same* file are executed concurrently
 *   via `test.concurrent()`, mutating `activeConfig` creates a race condition. For concurrent tests,
 *   prefer instantiating the app with local overrides via `makeApp({ config: customConfig })`
 *   to avoid mutating the shared module singleton.
 *
 * @param overrides Partial configuration values to merge into the active configuration.
 */
export function setTestConfig(overrides: Partial<ApiConfig>): void {
	activeConfig = {
		...activeConfig,
		...overrides,
		auth: { ...activeConfig.auth, ...overrides.auth },
		otp: { ...activeConfig.otp, ...overrides.otp },
		storage: { ...activeConfig.storage, ...overrides.storage },
		database: { ...activeConfig.database, ...overrides.database },
		redis: { ...activeConfig.redis, ...overrides.redis },
		requests: { ...activeConfig.requests, ...overrides.requests },
	};
}

/**
 * Resets the active configuration back to the default configuration constructed
 * from validated environment variables.
 *
 * Always call this in `afterEach()` or a `finally` block whenever `setTestConfig()`
 * is used to ensure test hygiene and avoid leaking state across sequential tests in the same file.
 */
export function resetTestConfig(): void {
	activeConfig = buildConfig();
}
