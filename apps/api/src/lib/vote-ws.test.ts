import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { MockRedisService } from '../infra/redis';
import {
	broadcastVoteToClients,
	cleanupVoteWs,
	createVoteWsRouter,
	publishVoteUpdate,
	setVoteRedis,
	setVoteWsApp,
	setVoteWsServer,
	VOTE_UPDATES_CHANNEL,
	type VoteWsServer,
} from './vote-ws';

describe('createVoteWsRouter', () => {
	let redis: MockRedisService;

	beforeEach(() => {
		redis = new MockRedisService();
		setVoteRedis(redis);
	});

	afterEach(async () => {
		await cleanupVoteWs();
		setVoteRedis(null);
	});

	test('open subscribes to native topic votes:requestId and close unsubscribes', () => {
		const router = createVoteWsRouter({ redis });

		const subscribed: string[] = [];
		const unsubscribed: string[] = [];

		const mockWs = {
			data: { params: { requestId: 'test-req-123' } },
			subscribe: (topic: string) => subscribed.push(topic),
			unsubscribe: (topic: string) => unsubscribed.push(topic),
		};

		// Inspect the route handler registered on the router
		const wsConfig = router.routes.find((r: { path: string }) => r.path === '/ws/votes/:requestId');
		expect(wsConfig).toBeDefined();

		const wsRoute = wsConfig as unknown as {
			hooks?: { websocket?: { open?: (ws: unknown) => void; close?: (ws: unknown) => void } };
			websocket?: { open?: (ws: unknown) => void; close?: (ws: unknown) => void };
		};
		const openFn = wsRoute.hooks?.websocket?.open ?? wsRoute.websocket?.open;
		const closeFn = wsRoute.hooks?.websocket?.close ?? wsRoute.websocket?.close;

		// Simulate open
		openFn?.(mockWs);
		expect(subscribed).toEqual(['votes:test-req-123']);

		// Simulate close
		closeFn?.(mockWs);
		expect(unsubscribed).toEqual(['votes:test-req-123']);
	});

	test('ignores open/close when requestId is missing or not a string', () => {
		const router = createVoteWsRouter({ redis });

		const subscribed: string[] = [];
		const unsubscribed: string[] = [];

		const mockWs = {
			data: { params: { requestId: undefined } },
			subscribe: (topic: string) => subscribed.push(topic),
			unsubscribe: (topic: string) => unsubscribed.push(topic),
		};

		const wsConfig = router.routes.find((r: { path: string }) => r.path === '/ws/votes/:requestId');
		const wsRoute = wsConfig as unknown as {
			hooks?: { websocket?: { open?: (ws: unknown) => void; close?: (ws: unknown) => void } };
			websocket?: { open?: (ws: unknown) => void; close?: (ws: unknown) => void };
		};
		const openFn = wsRoute.hooks?.websocket?.open ?? wsRoute.websocket?.open;
		const closeFn = wsRoute.hooks?.websocket?.close ?? wsRoute.websocket?.close;

		openFn?.(mockWs);
		expect(subscribed).toHaveLength(0);

		closeFn?.(mockWs);
		expect(unsubscribed).toHaveLength(0);
	});
});

describe('broadcastVoteToClients', () => {
	afterEach(async () => {
		await cleanupVoteWs();
	});

	test('publishes to topic votes:requestId with voteCount only (no hasVoted)', () => {
		const published: { topic: string; data: string }[] = [];
		const mockServer: VoteWsServer = {
			publish: (topic: string, data: string | ArrayBufferView | ArrayBuffer) => {
				published.push({ topic, data: String(data) });
				return 1;
			},
		};

		broadcastVoteToClients('req-456', 5, mockServer);

		expect(published).toHaveLength(1);
		expect(published[0]?.topic).toBe('votes:req-456');

		const parsed = JSON.parse(published[0]?.data ?? '{}') as Record<string, unknown>;
		expect(parsed).toEqual({ voteCount: 5 });
		// Criterion 5: Ensure hasVoted is NOT broadcast to passive listeners
		expect(parsed.hasVoted).toBeUndefined();
	});

	test('fans out via registered active server when server argument is omitted', () => {
		const published: { topic: string; data: string }[] = [];
		const mockServer: VoteWsServer = {
			publish: (topic: string, data: string | ArrayBufferView | ArrayBuffer) => {
				published.push({ topic, data: String(data) });
				return 1;
			},
		};

		setVoteWsServer(mockServer);
		broadcastVoteToClients('req-789', 10);

		expect(published).toHaveLength(1);
		expect(published[0]?.topic).toBe('votes:req-789');
		expect(JSON.parse(published[0]?.data ?? '{}')).toEqual({ voteCount: 10 });
	});

	test('fans out via registered active app.server', () => {
		const published: { topic: string; data: string }[] = [];
		const mockServer: VoteWsServer = {
			publish: (topic: string, data: string | ArrayBufferView | ArrayBuffer) => {
				published.push({ topic, data: String(data) });
				return 1;
			},
		};

		setVoteWsApp({ server: mockServer });
		broadcastVoteToClients('req-app-1', 3);

		expect(published).toHaveLength(1);
		expect(published[0]?.topic).toBe('votes:req-app-1');
		expect(JSON.parse(published[0]?.data ?? '{}')).toEqual({ voteCount: 3 });
	});

	test('gracefully does nothing if no server is configured', () => {
		expect(() => broadcastVoteToClients('req-none', 0)).not.toThrow();
	});
});

describe('publishVoteUpdate', () => {
	let redis: MockRedisService;

	beforeEach(() => {
		redis = new MockRedisService();
		setVoteRedis(redis);
	});

	afterEach(async () => {
		await cleanupVoteWs();
		setVoteRedis(null);
	});

	test('publishes JSON payload with requestId and voteCount to vote_updates channel', async () => {
		const received: { channel: string; message: string }[] = [];
		await redis.subscribe(VOTE_UPDATES_CHANNEL, (message, channel) => {
			received.push({ channel, message });
		});

		await publishVoteUpdate('req-pub-1', 42, redis);

		expect(received).toHaveLength(1);
		expect(received[0]?.channel).toBe(VOTE_UPDATES_CHANNEL);
		const payload = JSON.parse(received[0]?.message ?? '{}') as {
			requestId: string;
			voteCount: number;
		};
		expect(payload).toEqual({ requestId: 'req-pub-1', voteCount: 42 });
	});

	test('handles redis errors gracefully without throwing', async () => {
		const brokenRedis = {
			...new MockRedisService(),
			publish: () => Promise.reject(new Error('Redis connection lost')),
		};

		// @ts-expect-error passing broken mock
		const result = await publishVoteUpdate('req-err', 1, brokenRedis);
		expect(result).toBe(0);
	});
});

describe('Multi-instance broadcasting via Redis Pub/Sub', () => {
	let sharedRedis: MockRedisService;

	beforeEach(() => {
		sharedRedis = new MockRedisService();
	});

	afterEach(async () => {
		await cleanupVoteWs();
		setVoteRedis(null);
	});

	test('all running API instances subscribed to vote_updates fan out update to local clients', async () => {
		// Simulate Instance 1
		const instance1Published: { topic: string; data: string }[] = [];
		const server1: VoteWsServer = {
			publish: (topic: string, data: string | ArrayBufferView | ArrayBuffer) => {
				instance1Published.push({ topic, data: String(data) });
				return 1;
			},
		};
		createVoteWsRouter({ redis: sharedRedis, server: server1 });

		// Simulate Instance 2
		const instance2Published: { topic: string; data: string }[] = [];
		const server2: VoteWsServer = {
			publish: (topic: string, data: string | ArrayBufferView | ArrayBuffer) => {
				instance2Published.push({ topic, data: String(data) });
				return 1;
			},
		};
		createVoteWsRouter({ redis: sharedRedis, server: server2 });

		// Trigger a vote update published to Redis channel `vote_updates`
		const requestId = 'req-multi-instance';
		await publishVoteUpdate(requestId, 7, sharedRedis);

		// Both instances should have received the event from Redis and fanned out to their local clients
		expect(instance1Published).toHaveLength(1);
		expect(instance1Published[0]?.topic).toBe(`votes:${requestId}`);
		expect(JSON.parse(instance1Published[0]?.data ?? '{}')).toEqual({ voteCount: 7 });

		expect(instance2Published).toHaveLength(1);
		expect(instance2Published[0]?.topic).toBe(`votes:${requestId}`);
		expect(JSON.parse(instance2Published[0]?.data ?? '{}')).toEqual({ voteCount: 7 });

		// Both broadcasts must NOT contain hasVoted (Criterion 5)
		const parsed1 = JSON.parse(instance1Published[0]?.data ?? '{}') as Record<string, unknown>;
		const parsed2 = JSON.parse(instance2Published[0]?.data ?? '{}') as Record<string, unknown>;
		expect(parsed1.hasVoted).toBeUndefined();
		expect(parsed2.hasVoted).toBeUndefined();
	});

	test('unvoting fans out voteCount: 0 to all instances', async () => {
		const published: { topic: string; data: string }[] = [];
		const server: VoteWsServer = {
			publish: (topic: string, data: string | ArrayBufferView | ArrayBuffer) => {
				published.push({ topic, data: String(data) });
				return 1;
			},
		};
		createVoteWsRouter({ redis: sharedRedis, server });

		await publishVoteUpdate('req-unvote', 0, sharedRedis);

		expect(published).toHaveLength(1);
		expect(published[0]?.topic).toBe('votes:req-unvote');
		expect(JSON.parse(published[0]?.data ?? '{}')).toEqual({ voteCount: 0 });
	});
});

describe('Elysia native WebSocket live server integration', () => {
	let redis: MockRedisService;

	beforeEach(() => {
		redis = new MockRedisService();
		setVoteRedis(redis);
	});

	afterEach(async () => {
		await cleanupVoteWs();
		setVoteRedis(null);
	});

	test('live client receives vote update broadcast via server.publish on native topic', async () => {
		const requestId = 'req-live-test-1';
		const router = createVoteWsRouter({ redis });

		const app = new Elysia().use(router).listen(0);
		const port = app.server?.port;
		expect(port).toBeDefined();

		const messages: string[] = [];
		const ws = new WebSocket(`ws://localhost:${port}/ws/votes/${requestId}`);

		await new Promise<void>((resolve, reject) => {
			ws.onopen = () => resolve();
			ws.onerror = (e) => reject(e);
		});

		ws.onmessage = (event) => {
			messages.push(String(event.data));
		};

		// Publish vote update via Redis
		await publishVoteUpdate(requestId, 1, redis);

		// Wait briefly for WebSocket message delivery
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(messages).toHaveLength(1);
		const parsed = JSON.parse(messages[0] ?? '{}') as Record<string, unknown>;
		expect(parsed).toEqual({ voteCount: 1 });
		expect(parsed.hasVoted).toBeUndefined();

		// Another vote update (vote count increments to 2)
		await publishVoteUpdate(requestId, 2, redis);
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(messages).toHaveLength(2);
		expect(JSON.parse(messages[1] ?? '{}')).toEqual({ voteCount: 2 });

		ws.close();
		app.stop();
	});

	test('multiple passive listeners on the same topic receive voteCount without hasVoted', async () => {
		const requestId = 'req-passive-listeners';
		const router = createVoteWsRouter({ redis });

		const app = new Elysia().use(router).listen(0);
		const port = app.server?.port;

		const client1Messages: string[] = [];
		const client2Messages: string[] = [];

		const ws1 = new WebSocket(`ws://localhost:${port}/ws/votes/${requestId}`);
		const ws2 = new WebSocket(`ws://localhost:${port}/ws/votes/${requestId}`);

		await Promise.all([
			new Promise<void>((resolve) => {
				ws1.onopen = () => resolve();
			}),
			new Promise<void>((resolve) => {
				ws2.onopen = () => resolve();
			}),
		]);

		ws1.onmessage = (e) => client1Messages.push(String(e.data));
		ws2.onmessage = (e) => client2Messages.push(String(e.data));

		// Publish vote update via Redis
		await publishVoteUpdate(requestId, 42, redis);
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(client1Messages).toHaveLength(1);
		expect(client2Messages).toHaveLength(1);

		const data1 = JSON.parse(client1Messages[0] ?? '{}') as Record<string, unknown>;
		const data2 = JSON.parse(client2Messages[0] ?? '{}') as Record<string, unknown>;

		expect(data1).toEqual({ voteCount: 42 });
		expect(data2).toEqual({ voteCount: 42 });
		expect(data1.hasVoted).toBeUndefined();
		expect(data2.hasVoted).toBeUndefined();

		ws1.close();
		ws2.close();
		app.stop();
	});

	test('client subscribed to different requestId does not receive updates for another request', async () => {
		const router = createVoteWsRouter({ redis });

		const app = new Elysia().use(router).listen(0);
		const port = app.server?.port;

		const messagesA: string[] = [];
		const messagesB: string[] = [];

		const wsA = new WebSocket(`ws://localhost:${port}/ws/votes/request-aaa`);
		const wsB = new WebSocket(`ws://localhost:${port}/ws/votes/request-bbb`);

		await Promise.all([
			new Promise<void>((resolve) => {
				wsA.onopen = () => resolve();
			}),
			new Promise<void>((resolve) => {
				wsB.onopen = () => resolve();
			}),
		]);

		wsA.onmessage = (e) => messagesA.push(String(e.data));
		wsB.onmessage = (e) => messagesB.push(String(e.data));

		// Update only request-aaa
		await publishVoteUpdate('request-aaa', 15, redis);
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(messagesA).toHaveLength(1);
		expect(JSON.parse(messagesA[0] ?? '{}')).toEqual({ voteCount: 15 });
		expect(messagesB).toHaveLength(0);

		wsA.close();
		wsB.close();
		app.stop();
	});
});
