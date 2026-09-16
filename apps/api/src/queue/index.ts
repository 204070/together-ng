import { createDb, type Db, type Sql } from '@together/db';
import { PgBoss } from 'pg-boss';
import { type MatchingService, recomputeMatches } from '../worker/matching';

// ---------------------------------------------------------------------------
// Queue infrastructure choice: pg-boss (Postgres-backed, PRD 65.2).
//
// Why pg-boss over graphile-worker: pg-boss manages its own isolated
// `pgboss` schema automatically on `start()`, so this issue adds zero
// project migration files and keeps the single sequential migration history
// in `packages/db` conflict-free (D2). graphile-worker would need its own
// runner process plus a maintained migration set for the same Postgres.
// No Redis-backed queue and no vector DB are introduced (issue constraints,
// D15). The generic `createJobQueue` below is the reuse point for issue #34
// (notification dispatch reads `request_matches` and sends notifications);
// only the queue name + payload type + handler change there.
// ---------------------------------------------------------------------------

export const MATCHING_QUEUE = 'request-matching';

export interface MatchingJobData {
	requestId: string;
}

export interface JobQueueOptions<TData extends object> {
	connectionString: string;
	queue: string;
	pollingIntervalSeconds?: number;
	awaitTimeoutMs?: number;
	handler: (data: TData) => Promise<void>;
}

export interface JobQueue<TData extends object> {
	start(): Promise<void>;
	stop(): Promise<void>;
	send(data: TData): Promise<string | null>;
	/** Send a job and resolve once the worker completes it (inline fallback on timeout). */
	sendAndWait(data: TData): Promise<void>;
}

/**
 * Generic Postgres-backed job queue. One instance per queue name; callers in
 * other domains reuse this instead of adding new queue infrastructure.
 */
export function createJobQueue<TData extends object>(
	options: JobQueueOptions<TData>,
): JobQueue<TData> {
	const boss = new PgBoss({ connectionString: options.connectionString });
	const pollingIntervalSeconds = options.pollingIntervalSeconds ?? 1;
	const awaitTimeoutMs = options.awaitTimeoutMs ?? 15000;
	let started = false;

	async function waitForCompletion(jobId: string): Promise<boolean> {
		const deadline = Date.now() + awaitTimeoutMs;
		while (Date.now() < deadline) {
			const found = await boss.getJobById<TData>(options.queue, jobId);
			if (found?.state === 'completed') return true;
			if (found?.state === 'failed') throw new Error(`job ${jobId} failed`);
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		return false;
	}

	return {
		async start(): Promise<void> {
			if (started) return;
			await boss.start();
			await boss.createQueue(options.queue);
			await boss.work<TData>(options.queue, { pollingIntervalSeconds }, async (jobs) => {
				for (const job of jobs) {
					await options.handler(job.data);
				}
			});
			started = true;
		},
		async stop(): Promise<void> {
			if (!started) return;
			started = false;
			await boss.stop();
		},
		async send(data: TData): Promise<string | null> {
			return boss.send(options.queue, data);
		},
		async sendAndWait(data: TData): Promise<void> {
			let jobId: string | null = null;
			try {
				jobId = await boss.send(options.queue, data);
			} catch (error) {
				console.warn(`queue ${options.queue}: send failed, running inline`, error);
			}
			if (jobId) {
				try {
					if (await waitForCompletion(jobId)) return;
					console.warn(`queue ${options.queue}: job ${jobId} timed out, running inline`);
				} catch (error) {
					console.warn(`queue ${options.queue}: job ${jobId} errored, running inline`, error);
				}
			}
			await options.handler(data);
		},
	};
}

export interface MatchingQueueOptions {
	connectionString: string;
	db?: Db;
	sql?: Sql;
	now?: () => Date;
	pollingIntervalSeconds?: number;
	awaitTimeoutMs?: number;
}

function isMatchingJobData(data: unknown): data is MatchingJobData {
	return (
		typeof data === 'object' &&
		data !== null &&
		typeof (data as { requestId?: unknown }).requestId === 'string'
	);
}

export function createMatchingQueue(options: MatchingQueueOptions) {
	const db = options.db ?? createDb(options.sql ?? options.connectionString);
	const now = options.now ?? (() => new Date());
	const queue = createJobQueue<MatchingJobData>({
		connectionString: options.connectionString,
		queue: MATCHING_QUEUE,
		pollingIntervalSeconds: options.pollingIntervalSeconds,
		awaitTimeoutMs: options.awaitTimeoutMs,
		handler: async (data) => {
			if (!isMatchingJobData(data)) return;
			await recomputeMatches(db, data.requestId, { now });
		},
	});

	const service: MatchingService = {
		recompute: async (requestId: string) => {
			await queue.send({ requestId });
		},
	};

	return { ...queue, asService: (): MatchingService => service };
}

export type MatchingQueue = ReturnType<typeof createMatchingQueue>;
