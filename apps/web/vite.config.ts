import { resolve } from 'node:path';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, resolve(import.meta.dir, '../..'), '');
	const WEB_PORT = Number(env.WEB_PORT || process.env.WEB_PORT || 5007);

	return {
		plugins: [tanstackStart(), viteReact()],
		server: { port: WEB_PORT, strictPort: true },
	};
});
