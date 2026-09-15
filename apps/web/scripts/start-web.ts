import { loadEnv } from '@together/config';

// Serves the production build (dist/server/server.js, written by
// vite build) on the worktree typed WEB_PORT (D5).
const { WEB_PORT } = loadEnv();

// @ts-expect-error generated bundle has no declaration file
import handler from '../dist/server/server.js';

const server = Bun.serve({
	fetch: (handler as { fetch: (req: Request) => Response | Promise<Response> }).fetch,
	port: WEB_PORT,
});

console.log(`@together/web listening on http://localhost:${server.port}`);
