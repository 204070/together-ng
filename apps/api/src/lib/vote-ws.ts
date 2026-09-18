import { Elysia } from 'elysia';
import { getApiConfig } from '../config';
import {
	createRedisService,
	MockRedisService,
	type RedisService,
	type UnsubscribeFn,
} from '../infra/redis';

export const VOTE_UPDATES_CHANNEL = 'vote_updates';

export interface VoteWsServer {
	publish: (
		topic: string,
		data: string | ArrayBufferView | ArrayBuffer,
		compress?: boolean,
	) => unknown;
}

export interface VoteWsApp {
	server: VoteWsServer | null;
}

export interface VoteWsOptions {
	redis?: RedisService;
	server?: VoteWsServer | null;
	app?: VoteWsApp | null;
}

let defaultRedis: RedisService | null = null;
let activeServer: VoteWsServer | null = null;
let activeApp: VoteWsApp | null = null;
let defaultRedisUnsub: UnsubscribeFn | null = null;

export function getVoteRedis(): RedisService {
	if (!defaultRedis) {
		const config = getApiConfig();
		if (config.isTest) {
			defaultRedis = new MockRedisService();
		} else {
			defaultRedis = createRedisService(config.redisUrl);
		}
	}
	return defaultRedis;
}

export function setVoteRedis(service: RedisService | null): void {
	defaultRedis = service;
}

export function setVoteWsServer(server: VoteWsServer | null): void {
	activeServer = server;
}

export function getVoteWsServer(): VoteWsServer | null {
	return activeServer ?? activeApp?.server ?? null;
}

export function setVoteWsApp(app: VoteWsApp | null): void {
	activeApp = app;
}

export function broadcastVoteToClients(
	requestId: string,
	voteCount: number,
	server?: VoteWsServer | null,
): void {
	const targetServer = server ?? activeServer ?? activeApp?.server;
	if (!targetServer) return;
	const topic = `votes:${requestId}`;
	const payload = JSON.stringify({ voteCount });
	targetServer.publish(topic, payload);
}

export async function publishVoteUpdate(
	requestId: string,
	voteCount: number,
	redis?: RedisService,
): Promise<number> {
	const client = redis ?? getVoteRedis();
	try {
		const message = JSON.stringify({ requestId, voteCount });
		return await client.publish(VOTE_UPDATES_CHANNEL, message);
	} catch (error) {
		console.error('Failed to publish vote update to Redis:', error);
		return 0;
	}
}

export async function cleanupVoteWs(): Promise<void> {
	if (defaultRedisUnsub) {
		await defaultRedisUnsub();
		defaultRedisUnsub = null;
	}
	activeServer = null;
	activeApp = null;
}

export function createVoteWsRouter(options: VoteWsOptions = {}) {
	const redis = options.redis ?? getVoteRedis();

	if (options.server) {
		activeServer = options.server;
	}
	if (options.app) {
		activeApp = options.app;
	}

	let instanceUnsub: UnsubscribeFn | null = null;

	const messageHandler = (message: string) => {
		try {
			const data = JSON.parse(message) as { requestId?: string; voteCount?: number };
			if (data && typeof data.requestId === 'string' && typeof data.voteCount === 'number') {
				broadcastVoteToClients(data.requestId, data.voteCount, options.server);
			}
		} catch {
			// Ignore malformed message
		}
	};

	if (!options.redis && defaultRedisUnsub) {
		const prev = defaultRedisUnsub;
		defaultRedisUnsub = null;
		prev().catch(() => {});
	}

	const subPromise = redis.subscribe(VOTE_UPDATES_CHANNEL, messageHandler);
	subPromise
		.then((unsub) => {
			instanceUnsub = unsub;
			if (!options.redis) {
				defaultRedisUnsub = unsub;
			}
		})
		.catch((err) => {
			console.error('Failed to subscribe to vote_updates on Redis:', err);
		});

	return new Elysia()
		.onStart((app) => {
			if (app.server) {
				activeServer = app.server as unknown as VoteWsServer;
			}
			activeApp = app as unknown as VoteWsApp;
		})
		.onStop(async () => {
			if (instanceUnsub) {
				await instanceUnsub();
				instanceUnsub = null;
			}
			if (defaultRedisUnsub === instanceUnsub) {
				defaultRedisUnsub = null;
			}
		})
		.ws('/ws/votes/:requestId', {
			open(ws) {
				const requestId = ws.data.params.requestId;
				if (typeof requestId !== 'string' || !requestId) return;
				ws.subscribe(`votes:${requestId}`);
			},
			close(ws) {
				const requestId = ws.data.params.requestId;
				if (typeof requestId === 'string' && requestId) {
					ws.unsubscribe(`votes:${requestId}`);
				}
			},
			message() {
				// Client messages are ignored; this is a push-only channel
			},
		});
}
