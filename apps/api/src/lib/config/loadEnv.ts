import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Static, Type, Value, ValueErrorType } from '@together/schemas';
import { config as loadDotenv } from 'dotenv';

export const ApiEnvSchema = Type.Object({
	PORT: Type.Integer({ minimum: 1, default: 4000 }),
	NODE_ENV: Type.Union(
		[Type.Literal('development'), Type.Literal('production'), Type.Literal('test')],
		{ default: 'development' },
	),
	DATABASE_URL: Type.String({ minLength: 1 }),
	JWT_SECRET: Type.String({ minLength: 1 }),
	REDIS_URL: Type.String({ default: '' }),
	OTP_PROVIDER: Type.Union([Type.Literal('mock'), Type.Literal('termii')], {
		default: 'mock',
	}),
	TERMII_API_KEY: Type.String({ default: '' }),
	TERMII_SENDER_ID: Type.String({ default: '' }),
	STORAGE_PROVIDER: Type.Union([Type.Literal('mock'), Type.Literal('s3')], {
		default: 'mock',
	}),
	STORAGE_BUCKET: Type.String({ default: 'together-uploads' }),
	STORAGE_ENDPOINT: Type.String({ default: '' }),
	STORAGE_ACCESS_KEY_ID: Type.String({ default: '' }),
	STORAGE_SECRET_ACCESS_KEY: Type.String({ default: '' }),
	STORAGE_REGION: Type.String({ default: 'us-east-1' }),
	STORAGE_PUBLIC_URL: Type.String({ default: '' }),
});

export type ApiEnv = Static<typeof ApiEnvSchema>;

function moduleDir(): string | undefined {
	const meta = import.meta as ImportMeta & { dir?: string };
	if (meta.dir) return meta.dir;
	try {
		return dirname(fileURLToPath(import.meta.url));
	} catch {
		return undefined;
	}
}

function envFilePath(): string | undefined {
	const candidates = [
		resolve(process.cwd(), '.env'),
		resolve(process.cwd(), '../../.env'),
		resolve(moduleDir() ?? '.', '../../../../.env'),
	];
	return candidates.find(existsSync);
}

function reason(type: ValueErrorType): string {
	switch (type) {
		case ValueErrorType.ObjectRequiredProperty:
			return 'required but missing';
		case ValueErrorType.Union:
		case ValueErrorType.Literal:
			return 'not a declared literal';
		case ValueErrorType.StringMinLength:
			return 'too short';
		default:
			return 'wrong type';
	}
}

function validationErrors(value: unknown): string[] {
	const messages: string[] = [];
	const seen = new Set<string>();
	for (const error of Value.Errors(ApiEnvSchema, value)) {
		const varName = error.path.replace(/^\//, '');
		if (varName === '' || seen.has(varName)) continue;
		seen.add(varName);
		messages.push(`- ${varName}: ${reason(error.type)}`);
	}
	return messages;
}

let cachedEnv: ApiEnv | undefined;

/**
 * Loads, parses, and strictly validates environment variables against `ApiEnvSchema`.
 *
 * - When called without arguments (`source === undefined`):
 *   1. Searches candidate locations for `.env` (`cwd`, parent monorepo root, or relative to module)
 *   2. Loads `.env` via dotenv (overriding ambient vars)
 *   3. Parses and validates against `ApiEnvSchema` with type coercion and defaults
 *   4. Caches and freezes the result for subsequent calls in the same process/isolate
 *
 * - When called with an explicit `source` (e.g. `{ DATABASE_URL: '...', ... }` in tests):
 *   Validates and returns the parsed environment without caching or mutating process state.
 *
 * @param source Optional dictionary of environment key-value pairs to validate. Defaults to `process.env`.
 * @throws {Error} If any required environment variable is missing or invalid according to `ApiEnvSchema`.
 * @returns Strongly typed, validated `ApiEnv` object.
 */
export function loadEnv(source?: Record<string, unknown>): ApiEnv {
	if (source === undefined && cachedEnv !== undefined) {
		return cachedEnv;
	}

	if (source === undefined) {
		const envPath = envFilePath();
		if (envPath !== undefined) {
			loadDotenv({ path: envPath, override: true, quiet: true });
		}
		source = process.env;
	}

	const raw: Record<string, unknown> = { ...source };
	if ('PORT' in raw && typeof raw.PORT === 'string') {
		raw.PORT = Number(raw.PORT);
	}

	try {
		const parsed = Value.Parse(ApiEnvSchema, raw);
		if (source === process.env) {
			cachedEnv = Object.freeze(parsed);
		}
		return parsed;
	} catch {
		throw new Error(
			`API Environment validation failed:\n${validationErrors(Value.Default(ApiEnvSchema, raw)).join('\n')}`,
		);
	}
}

/**
 * Resets the in-memory cached environment singleton.
 *
 * Useful in unit tests that alter `process.env` and want `loadEnv()` to re-read
 * and re-validate from scratch.
 */
export function resetCachedEnv(): void {
	cachedEnv = undefined;
}
