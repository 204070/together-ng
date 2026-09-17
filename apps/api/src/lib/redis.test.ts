import { describe, expect, test } from 'bun:test';
import {
	BunRedisService,
	createRedisConnection,
	createRedisService,
	MockRedisService,
} from './redis';

describe('MockRedisService', () => {
	test('get and set basic key-values', async () => {
		const redis = new MockRedisService();
		expect(await redis.get('key1')).toBeNull();

		const res = await redis.set('key1', 'val1');
		expect(res).toBe('OK');
		expect(await redis.get('key1')).toBe('val1');
	});

	test('set with nx and xx options', async () => {
		const redis = new MockRedisService();

		// nx: only set if not exists
		const r1 = await redis.set('k', 'v1', { nx: true });
		expect(r1).toBe('OK');
		const r2 = await redis.set('k', 'v2', { nx: true });
		expect(r2).toBeNull();
		expect(await redis.get('k')).toBe('v1');

		// xx: only set if exists
		const r3 = await redis.set('nonexistent', 'v', { xx: true });
		expect(r3).toBeNull();
		const r4 = await redis.set('k', 'v3', { xx: true });
		expect(r4).toBe('OK');
		expect(await redis.get('k')).toBe('v3');
	});

	test('set with ttl options and expire cleanup', async () => {
		const redis = new MockRedisService();
		await redis.set('temp', 'val', 10); // 10 seconds TTL
		expect(await redis.get('temp')).toBe('val');
		expect(await redis.ttl('temp')).toBeGreaterThan(0);

		// expire manually
		await redis.expire('temp', 100);
		expect(await redis.ttl('temp')).toBeGreaterThan(50);

		// ttl for non-existent key
		expect(await redis.ttl('nonexistent')).toBe(-2);

		// ttl for key without expiry
		await redis.set('persist', 'forever');
		expect(await redis.ttl('persist')).toBe(-1);
	});

	test('del and exists operations', async () => {
		const redis = new MockRedisService();
		await redis.set('a', '1');
		await redis.set('b', '2');

		expect(await redis.exists('a', 'b', 'c')).toBe(2);
		expect(await redis.del('a')).toBe(1);
		expect(await redis.exists('a')).toBe(0);
		expect(await redis.del('a')).toBe(0);
		expect(await redis.exists('b')).toBe(1);
	});

	test('incr and incrWithExpire atomic operations', async () => {
		const redis = new MockRedisService();

		// incr on new key
		expect(await redis.incr('counter')).toBe(1);
		expect(await redis.incr('counter')).toBe(2);
		expect(await redis.ttl('counter')).toBe(-1); // no TTL set

		// incrWithExpire sets TTL atomically
		expect(await redis.incrWithExpire('rate:key', 60)).toBe(1);
		expect(await redis.ttl('rate:key')).toBeGreaterThan(0);
		expect(await redis.incrWithExpire('rate:key', 60)).toBe(2);
		expect(await redis.ttl('rate:key')).toBeGreaterThan(0);

		// incrWithExpire on key without TTL adds TTL
		expect(await redis.incrWithExpire('counter', 30)).toBe(3);
		expect(await redis.ttl('counter')).toBeGreaterThan(0);
	});

	test('eval executes atomic rate limit script', async () => {
		const redis = new MockRedisService();
		const val = await redis.eval('script', ['mykey'], [60]);
		expect(val).toBe(1);
		expect(await redis.ttl('mykey')).toBeGreaterThan(0);
	});

	test('pub/sub publish and subscribe', async () => {
		const redis = new MockRedisService();
		const messages: string[] = [];

		const unsub = await redis.subscribe('events', (msg, ch) => {
			messages.push(`${ch}:${msg}`);
		});

		const count = await redis.publish('events', 'hello');
		expect(count).toBe(1);
		expect(messages).toEqual(['events:hello']);

		// Unsubscribe stops delivery
		await unsub();
		const countAfter = await redis.publish('events', 'world');
		expect(countAfter).toBe(0);
		expect(messages).toEqual(['events:hello']);
	});

	test('pub/sub multiple listeners on same channel', async () => {
		const redis = new MockRedisService();
		let count1 = 0;
		let count2 = 0;

		const unsub1 = await redis.subscribe('topic', () => {
			count1++;
		});
		const unsub2 = await redis.subscribe('topic', () => {
			count2++;
		});

		const subCount = await redis.publish('topic', 'msg1');
		expect(subCount).toBe(2);
		expect(count1).toBe(1);
		expect(count2).toBe(1);

		// Unsubscribe one listener
		await unsub1();
		const subCount2 = await redis.publish('topic', 'msg2');
		expect(subCount2).toBe(1);
		expect(count1).toBe(1);
		expect(count2).toBe(2);

		await unsub2();
	});

	test('generic send and sendRaw commands', async () => {
		const redis = new MockRedisService();
		expect(await redis.send('PING')).toBe('PONG');

		await redis.send('SET', 'foo', 'bar');
		expect(await redis.send('GET', 'foo')).toBe('bar');
		expect(await redis.sendRaw('GET foo')).toBe('bar');

		await redis.send('INCR', 'hits');
		expect(await redis.sendRaw('GET hits')).toBe('1');
	});

	test('close lifecycle cleans up state', async () => {
		const redis = new MockRedisService();
		expect(redis.connected).toBe(true);
		expect(redis.isConnected).toBe(true);

		await redis.set('k', 'v');
		redis.close();

		expect(redis.connected).toBe(false);
		expect(redis.isConnected).toBe(false);
	});
});

describe('BunRedisService architecture', () => {
	test('initializes with custom pool size and options', () => {
		// Verify BunRedisService accepts options and instantiates pool when Bun.RedisClient is available
		const service = new BunRedisService({
			url: 'redis://127.0.0.1:6379',
			poolSize: 3,
			autoReconnect: true,
			maxRetries: 5,
		});

		expect(service.connected).toBe(true);
		expect(service.isConnected).toBe(true);
		service.close();
		expect(service.connected).toBe(false);
	});

	test('factory functions instantiate RedisService', async () => {
		const svc = createRedisService({ poolSize: 2 });
		expect(svc.connected).toBe(true);
		svc.close();

		const conn = await createRedisConnection('redis://localhost:6379');
		expect(conn.connected).toBe(true);
		conn.close();
	});
});
