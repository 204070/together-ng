import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// D5: the worktree's ADMIN_PORT (pinned from the repo .env via pin-env in
// the `dev` script) keeps parallel admin dev servers off each other.
// Plain `vite` without that env falls back to 5173.
const port = Number(process.env.ADMIN_PORT ?? 5173);

export default defineConfig({
	plugins: [react()],
	server: {
		port,
	},
	preview: {
		port,
	},
});
