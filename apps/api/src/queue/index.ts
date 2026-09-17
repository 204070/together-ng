import { createDb, type Db, getDatabase } from '@together/db';
import { type ConnectionOptions, Queue, QueueEvents, Worker } from 'bullmq';
import { type MatchingService, recomputeMatches } from '../worker/matching';
import {
	dispatchNotifications,
	NOTIFICATION_QUEUE,
	type NotificationDispatchJobData,
	type NotificationService,
} from '../worker/notifications';

export const MATCHING_QUEUE = 'request-matching';

export interface MatchingJobData {
	requestId: string;
}

export function parseRedisUrl(redisUrl?: string): ConnectionOptions {
	const urlStr = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379/0';
	try {
		const parsed = new URL(urlStr);
		const db = parsed.pathname && parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0;
		return {
			host: parsed.hostname || 'localhost',
			port: parsed.port ? Number(parsed.port) : 6379,
			username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
			password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
			db: Number.isNaN(db) ? 0 : db,
			maxRetriesPerRequest: null,
		};
	} catch {
		return {
			host: 'localhost',
			port: 6379,
			maxRetriesPerRequest: null,
		};
	}
}

export interface JobQueueOptions<TData extends object> {
	redisUrl?: string;
	connectionString?: string;
	connection?: ConnectionOptions;
	queue: string;
	pollingIntervalSeconds?: number;
	awaitTimeoutMs?: number;
	handler: (data: TData) => Promise<void>;
	getJobId?: (data: TData) => string | undefined;
}

export interface JobQueue<TData extends object> {
	start(): Promise<void>;
	stop(): Promise<void>;
	send(data: TData): Promise<string | null>;
	sendAndWait(data: TData): Promise<void>;
	getCompletedCount(): Promise<number>;
	bullQueue: Queue;
	bullWorker?: Worker;
}

export function createJobQueue<TData extends object>(
	options: JobQueueOptions<TData>,
): JobQueue<TData> {
	const connection: ConnectionOptions =
		options.connection ??
		(options.redisUrl
			? parseRedisUrl(options.redisUrl)
			: options.connectionString?.startsWith('redis')
				? parseRedisUrl(options.connectionString)
				: parseRedisUrl(process.env.REDIS_URL));

	const bullQueue = new Queue(options.queue, {
		connection,
		defaultJobOptions: {
			removeOnComplete: { count: 1000 },
			removeOnFail: { count: 1000 },
		},
	});

	let bullWorker: Worker | undefined;
	let queueEvents: QueueEvents | undefined;
	let started = false;
	const awaitTimeoutMs = options.awaitTimeoutMs ?? 15000;

	const send = async (data: TData): Promise<string | null> => {
		const jobId = options.getJobId?.(data);
		if (jobId) {
			try {
				const existing = await bullQueue.getJob(jobId);
				if (existing) {
					const state = await existing.getState();
					if (state === 'completed' || state === 'failed') {
						await existing.remove();
					}
				}
			} catch {
				// Ignore errors checking existing job
			}
		}
		const job = await bullQueue.add('default', data, {
			jobId,
			removeOnComplete: { count: 1000 },
			removeOnFail: { count: 1000 },
		});
		return job.id ?? jobId ?? null;
	};

	return {
		bullQueue,
		get bullWorker() {
			return bullWorker;
		},
		async start(): Promise<void> {
			if (started) return;
			started = true;
			bullWorker = new Worker(
				options.queue,
				async (job) => {
					await options.handler(job.data as TData);
				},
				{
					connection,
				},
			);
		},
		async stop(): Promise<void> {
			started = false;
			if (bullWorker) {
				await bullWorker.close();
				bullWorker = undefined;
			}
			if (queueEvents) {
				await queueEvents.close();
				queueEvents = undefined;
			}
			await bullQueue.close();
		},
		send,
		async sendAndWait(data: TData): Promise<void> {
			let jobId: string | null = null;
			try {
				jobId = await send(data);
			} catch (error) {
				console.warn(`queue ${options.queue}: send failed, running inline`, error);
			}
			if (jobId) {
				try {
					if (!queueEvents) {
						queueEvents = new QueueEvents(options.queue, { connection });
					}
					const job = await bullQueue.getJob(jobId);
					if (job) {
						await Promise.race([
							job.waitUntilFinished(queueEvents),
							new Promise((_, reject) =>
								setTimeout(() => reject(new Error('timeout')), awaitTimeoutMs),
							),
						]);
						return;
					}
				} catch (error) {
					console.warn(
						`queue ${options.queue}: job ${jobId} failed or timed out, running inline`,
						error,
					);
				}
			}
			await options.handler(data);
		},
		async getCompletedCount(): Promise<number> {
			return bullQueue.getCompletedCount();
		},
	};
}

export interface MatchingQueueOptions {
	redisUrl?: string;
	connectionString?: string;
	connection?: ConnectionOptions;
	db?: Db;
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

export function createMatchingQueue(options: MatchingQueueOptions = {}) {
	const db =
		options.db ??
		(options.connectionString && !options.connectionString.startsWith('redis')
			? createDb(options.connectionString)
			: getDatabase());
	const now = options.now ?? (() => new Date());

	const notificationQueue = createNotificationQueue({
		redisUrl: options.redisUrl,
		connectionString: options.connectionString,
		connection: options.connection,
		db,
	});

	const queue = createJobQueue<MatchingJobData>({
		redisUrl: options.redisUrl,
		connectionString: options.connectionString,
		connection: options.connection,
		queue: MATCHING_QUEUE,
		pollingIntervalSeconds: options.pollingIntervalSeconds,
		awaitTimeoutMs: options.awaitTimeoutMs,
		getJobId: (data) => data.requestId,
		handler: async (data) => {
			if (!isMatchingJobData(data)) return;
			await recomputeMatches(db, data.requestId, { now });
			await notificationQueue.send({ requestId: data.requestId });
		},
	});

	const service: MatchingService = {
		recompute: async (requestId: string) => {
			await queue.send({ requestId });
		},
	};

	return {
		...queue,
		start: async () => {
			await queue.start();
			await notificationQueue.start();
		},
		stop: async () => {
			await queue.stop();
			await notificationQueue.stop();
		},
		asService: (): MatchingService => service,
		notificationQueue,
	};
}

export type MatchingQueue = ReturnType<typeof createMatchingQueue>;

export interface NotificationQueueOptions {
	redisUrl?: string;
	connectionString?: string;
	connection?: ConnectionOptions;
	db: Db;
	pollingIntervalSeconds?: number;
	awaitTimeoutMs?: number;
}

function isNotificationDispatchJobData(data: unknown): data is NotificationDispatchJobData {
	return (
		typeof data === 'object' &&
		data !== null &&
		typeof (data as { requestId?: unknown }).requestId === 'string'
	);
}

export function createNotificationQueue(options: NotificationQueueOptions) {
	const queue = createJobQueue<NotificationDispatchJobData>({
		redisUrl: options.redisUrl,
		connectionString: options.connectionString,
		connection: options.connection,
		queue: NOTIFICATION_QUEUE,
		pollingIntervalSeconds: options.pollingIntervalSeconds,
		awaitTimeoutMs: options.awaitTimeoutMs,
		getJobId: (data) => data.requestId,
		handler: async (data) => {
			if (!isNotificationDispatchJobData(data)) return;
			await dispatchNotifications(options.db, data.requestId);
		},
	});

	const service: NotificationService = {
		dispatch: async (requestId: string) => {
			await queue.send({ requestId });
			return { sent: 0, suppressed: 0 };
		},
	};

	return { ...queue, asService: (): NotificationService => service };
}

export type NotificationQueue = ReturnType<typeof createNotificationQueue>;
