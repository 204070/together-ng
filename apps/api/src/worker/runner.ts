import { getApiConfig } from '../config';
import { type Db, getPool, initDatabase } from '../infra/database';
import { createMatchingQueue } from '../queue';

export interface WorkerRunnerOptions {
	db?: Db;
	redisUrl?: string;
	now?: () => Date;
}

export interface WorkerRunner {
	start(): Promise<void>;
	stop(): Promise<void>;
}

export function createWorkerRunner(options: WorkerRunnerOptions = {}): WorkerRunner {
	const config = getApiConfig();
	const db = options.db ?? initDatabase(config.databaseUrl);
	const redisUrl = options.redisUrl ?? config.redisUrl;

	const matchingQueue = createMatchingQueue({
		db,
		redisUrl,
		now: options.now,
	});

	return {
		async start() {
			await matchingQueue.start();
		},
		async stop() {
			await matchingQueue.stop();
		},
	};
}

export async function runWorkers(options: WorkerRunnerOptions = {}) {
	const runner = createWorkerRunner(options);
	await runner.start();
	console.log('[worker] Matching and notification workers started');

	const shutdown = async (signal: string) => {
		console.log(`[worker] Received ${signal}, shutting down...`);
		await runner.stop();
		try {
			await getPool().end();
		} catch {
			// Pool may already be closed
		}
		process.exit(0);
	};

	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));

	return runner;
}

if (import.meta.main) {
	await runWorkers();
}
