import { makeApp } from './app';
import { getApiConfig } from './config';
import { initDatabase } from './infra/database';
import { createMatchingQueue } from './queue';

const config = getApiConfig();
const port = config.port;

const db = initDatabase(config.databaseUrl);
const matchingQueue = createMatchingQueue({
	redisUrl: config.redisUrl,
	db,
});

const serverApp = makeApp({
	db,
	matching: matchingQueue.asService(),
});

serverApp
	.listen(port, async () => {
		if (!config.isTest) {
			console.log(`@together/api listening on http://localhost:${port}`);
		}
	})
	.on('error', (error) => {
		console.error('@together/api failed to boot:', error);
		process.exit(1);
	});
