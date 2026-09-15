import { env, loadEnv } from '@together/config';
import { app } from './app';
import type { RequestServices } from './modules/requests/services';
import { createMatchingQueue } from './queue';

loadEnv();

const port = env.PORT;

function requestServicesOf(target: typeof app): RequestServices {
	return (target as unknown as { decorator: { requestServices: RequestServices } }).decorator
		.requestServices;
}

// Production/dev boot: attach the Postgres-backed matching worker (pg-boss)
// to the request services, then serve. Tests build their own app via
// makeApp() with an injected matching service and never run this file.
const services = requestServicesOf(app);
const matchingQueue = createMatchingQueue({
	connectionString: env.DATABASE_URL,
	sql: services.sql,
	now: services.now,
});
services.matching = matchingQueue.asService();

await matchingQueue.start();

app
	.listen(port, async () => {
		if (env.NODE_ENV !== 'test') {
			console.log(`@together/api listening on http://localhost:${port}`);
		}
	})
	.on('error', (error) => {
		console.error('@together/api failed to boot:', error);
		process.exit(1);
	});
