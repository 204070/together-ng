import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PINNED = new Set(['DATABASE_URL', 'TEST_DATABASE_URL', 'PORT', 'WEB_PORT', 'ADMIN_PORT']);

const REPO_ROOT = resolve(import.meta.dir, '..');

function envFilePath(): string | undefined {
	const candidates = [resolve(process.cwd(), '.env'), resolve(REPO_ROOT, '.env')];
	return candidates.find(existsSync);
}

function loadEnvFile(path: string): Record<string, string> {
	const env: Record<string, string> = {};
	for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line.length === 0 || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq === -1) continue;
		let key = line.slice(0, eq).trim();
		if (key.startsWith('export ')) key = key.slice(7).trim();
		let value = line.slice(eq + 1).trim();
		value = value.replace(/\s+#.*$/, '').trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (key.length > 0) env[key] = value;
	}
	return env;
}

const envPath = envFilePath();
if (envPath) {
	const fileEnv = loadEnvFile(envPath);
	for (const [key, value] of Object.entries(fileEnv)) {
		if (PINNED.has(key) || process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

const rest = process.argv.slice(2);
const result = spawnSync(process.execPath, ['run', ...rest], {
	stdio: 'inherit',
	env: process.env,
});

const command = `bun run ${rest.join(' ')}`;
if (result.error) {
	console.error(`pin-env: failed to run "${command}": ${result.error.message}`);
	process.exit(1);
}
if (result.signal) {
	console.error(`pin-env: "${command}" was terminated by signal ${result.signal}`);
	process.exit(1);
}
process.exit(result.status ?? 1);
