import { env, loadEnv } from '@together/config';
import { initDatabase } from '@together/db';
import { makeApp } from './app';
import { createMatchingQueue } from './queue';

loadEnv();

const port = env.PORT;

const db = initDatabase(env.DATABASE_URL);
const matchingQueue = createMatchingQueue({
	redisUrl: env.REDIS_URL,
	db,
});

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
