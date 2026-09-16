import { env, loadEnv } from '@together/config';
import { createDb } from '@together/db';
import { makeApp } from './app';
import { createMatchingQueue } from './queue';

loadEnv();

const port = env.PORT;

const db = createDb(env.DATABASE_URL);
const matchingQueue = createMatchingQueue({
	connectionString: env.DATABASE_URL,
	db,
});

await matchingQueue.start();

const serverApp = makeApp({
	db,
	matching: matchingQueue.asService(),
});

serverApp
	.listen(port, async () => {
		if (env.NODE_ENV !== 'test') {
			console.log(`@together/api listening on http://localhost:${port}`);
		}
	})
	.on('error', (error) => {
		console.error('@together/api failed to boot:', error);
		process.exit(1);
	});
