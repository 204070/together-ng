import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, resolve(import.meta.dir, '../..'), '');
	const port = Number(env.ADMIN_PORT || process.env.ADMIN_PORT || 5173);

	return {
		plugins: [react()],
		server: {
			port,
		},
		preview: {
			port,
		},
	};
});
