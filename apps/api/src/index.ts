import { env, loadEnv } from '@together/config';
import { createClient } from '@together/db';
import { makeApp } from './app';
import { createMatchingQueue } from './queue';

loadEnv();

const port = env.PORT;

const sql = createClient(env.DATABASE_URL);
const matchingQueue = createMatchingQueue({
	connectionString: env.DATABASE_URL,
	sql,
});

await matchingQueue.start();

const serverApp = makeApp({
	sql,
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
