import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';

function moduleDir(): string | undefined {
	const meta = import.meta as ImportMeta & { dir?: string };
	if (meta.dir) return meta.dir;
	try {
		return dirname(fileURLToPath(import.meta.url));
	} catch {
		return undefined;
	}
}

const rootEnvCandidates = [
	resolve(moduleDir() ?? '.', '../../.env'),
	resolve(process.cwd(), '../../.env'),
	resolve(process.cwd(), '.env'),
];

export function loadEnv(): void {
	const path = rootEnvCandidates.find((candidate) => existsSync(candidate)) ?? rootEnvCandidates[0];
	loadEnvFile({ path, quiet: true });
}
