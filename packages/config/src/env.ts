import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Static, Type, Value, ValueErrorType } from '@together/schemas';
import { config as loadDotenv } from 'dotenv';

const EnvSchema = Type.Object({
	PORT: Type.Integer({ minimum: 1, default: 4000 }),
	WEB_PORT: Type.Integer({ minimum: 1, default: 5000 }),
	ADMIN_PORT: Type.Integer({ minimum: 1, default: 5100 }),
	NODE_ENV: Type.String({ default: 'development' }),
	OTP_PROVIDER: Type.Union([Type.Literal('mock'), Type.Literal('termii')], {
		default: 'mock',
	}),
	DATABASE_URL: Type.String({ minLength: 1 }),
	JWT_SECRET: Type.String({ minLength: 1 }),
	TERMII_API_KEY: Type.String({ default: '' }),
	TERMII_SENDER_ID: Type.String({ default: '' }),
	REDIS_URL: Type.String({ default: '' }),
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

export type ConfigEnv = Static<typeof EnvSchema>;

const INTEGER_KEYS = ['PORT', 'WEB_PORT', 'ADMIN_PORT'] as const;

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
		resolve(moduleDir() ?? '.', '../../.env'),
		resolve(process.cwd(), '../../.env'),
		resolve(process.cwd(), '.env'),
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

function effectiveDefault(varName: string): string {
	const property = (EnvSchema.properties as Record<string, { default?: unknown }>)[varName];
	if (property !== undefined && 'default' in property) {
		return JSON.stringify(property.default);
	}
	return '(none)';
}

function validationErrors(value: unknown): string[] {
	const messages: string[] = [];
	const seen = new Set<string>();
	for (const error of Value.Errors(EnvSchema, value)) {
		const varName = error.path.replace(/^\//, '');
		if (varName === '' || seen.has(varName)) continue;
		seen.add(varName);
		const hint = varName === 'JWT_SECRET' ? ' — set it, e.g. `openssl rand -hex 32`' : '';
		messages.push(
			`- ${varName}: ${reason(error.type)} (effective default: ${effectiveDefault(varName)})${hint}`,
		);
	}
	return messages;
}

let _env: ConfigEnv | undefined;
let _loaded = false;

export let env: ConfigEnv;

export function loadEnv(source?: Record<string, unknown>): ConfigEnv {
	if (_loaded && _env !== undefined) return _env;
	_loaded = true;

	if (source === undefined) {
		const envPath = envFilePath();
		if (envPath !== undefined) {
			loadDotenv({ path: envPath, quiet: true });
		}
		source = process.env;
	}

	const raw: Record<string, unknown> = { ...source };
	for (const key of INTEGER_KEYS) {
		if (key in raw) raw[key] = Number(raw[key]);
	}

	try {
		_env = Value.Parse(EnvSchema, raw);
	} catch {
		throw new Error(
			`Environment validation failed:\n${validationErrors(Value.Default(EnvSchema, raw)).join('\n')}`,
		);
	}

	env = Object.freeze(_env);
	return _env;
}

export const PINNED_VARS = [
	'DATABASE_URL',
	'TEST_DATABASE_URL',
	'PORT',
	'WEB_PORT',
	'ADMIN_PORT',
] as const;
