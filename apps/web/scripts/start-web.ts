const port = process.env.WEB_PORT ? Number(process.env.WEB_PORT) : 5000;

// @ts-expect-error generated bundle has no declaration file
import handler from '../dist/server/server.js';

const server = Bun.serve({
	fetch: (handler as { fetch: (req: Request) => Response | Promise<Response> }).fetch,
	port,
});

console.log(`@together/web listening on http://localhost:${server.port}`);
