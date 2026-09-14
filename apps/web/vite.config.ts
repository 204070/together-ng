import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function loadEnvFile(path: string): Record<string, string> {
	try {
		const content = readFileSync(path, 'utf-8');
		const env: Record<string, string> = {};
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eqIdx = trimmed.indexOf('=');
			if (eqIdx > 0) {
				const key = trimmed.slice(0, eqIdx).trim();
				const value = trimmed.slice(eqIdx + 1).trim();
				env[key] = value;
			}
		}
		return env;
	} catch {
		return {};
	}
}

const envFile = loadEnvFile(resolve(process.cwd(), '.env'));
const WEB_PORT = Number(envFile.WEB_PORT ?? process.env.WEB_PORT ?? 5007);

export default defineConfig({
	plugins: [tanstackStart(), viteReact()],
	server: { port: WEB_PORT, strictPort: true },
});
