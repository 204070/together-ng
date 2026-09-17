declare global {
	namespace Bun {
		interface RedisClientOptions {
			autoReconnect?: boolean;
			maxRetries?: number;
			idleTimeout?: number;
			connectionTimeout?: number;
			enableAutoPipelining?: boolean;
		}

		class RedisClient {
			constructor(url?: string, options?: RedisClientOptions);
			get(key: string): Promise<string | null>;
			set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
			del(...keys: string[]): Promise<number>;
			exists(...keys: string[]): Promise<number>;
			expire(key: string, seconds: number): Promise<number>;
			ttl(key: string): Promise<number>;
			incr(key: string): Promise<number>;
			publish(channel: string, message: string): Promise<number>;
			subscribe(
				channel: string,
				callback: (message: string, channel: string) => void,
			): Promise<void>;
			unsubscribe(channel?: string): Promise<void>;
			send(command: string, args?: (string | number)[]): Promise<unknown>;
			close(): void;
			duplicate(): Promise<RedisClient> | RedisClient;
		}

		const redis: RedisClient | undefined;
	}
}

export interface SetOptions {
	ex?: number;
	px?: number;
	nx?: boolean;
	xx?: boolean;
}

export type PubSubHandler = (message: string, channel: string) => void | Promise<void>;
export type UnsubscribeFn = () => Promise<void>;

export interface RedisService {
	readonly connected: boolean;
	readonly isConnected: boolean;
	close(): Promise<void> | void;

	get(key: string): Promise<string | null>;
	set(key: string, value: string, options?: SetOptions | number): Promise<'OK' | string | null>;
	del(...keys: string[]): Promise<number>;
	exists(...keys: string[]): Promise<number>;
	expire(key: string, seconds: number): Promise<number | boolean>;
	ttl(key: string): Promise<number>;

	incr(key: string): Promise<number>;
	incrWithExpire(key: string, ttlSeconds: number): Promise<number>;
	eval<T = unknown>(script: string, keys: string[], args: (string | number)[]): Promise<T>;

	publish(channel: string, message: string): Promise<number>;
	subscribe(channel: string, handler: PubSubHandler): Promise<UnsubscribeFn>;
	unsubscribe(channel: string, handler?: PubSubHandler): Promise<void>;

	send(command: string, ...args: (string | number | (string | number)[])[]): Promise<unknown>;
	sendRaw?(line: string): Promise<string>;
}

export type RedisConnection = RedisService;

export interface BunRedisOptions {
	url?: string;
	poolSize?: number;
	autoReconnect?: boolean;
	maxRetries?: number;
	idleTimeout?: number;
	connectionTimeout?: number;
}

export class BunRedisService implements RedisService {
	private readonly pool: Bun.RedisClient[] = [];
	private subscriberClient: Bun.RedisClient | null = null;
	private poolIndex = 0;
	private readonly poolSize: number;
	private readonly url: string;
	private readonly clientOptions: Bun.RedisClientOptions;
	private isClosed = false;
	private readonly subscribers = new Map<string, Set<PubSubHandler>>();

	constructor(options: BunRedisOptions | string = {}) {
		const opts: BunRedisOptions = typeof options === 'string' ? { url: options } : options;
		this.url = opts.url ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
		this.poolSize = Math.max(1, opts.poolSize ?? 5);
		this.clientOptions = {
			autoReconnect: opts.autoReconnect ?? true,
			...(opts.maxRetries !== undefined ? { maxRetries: opts.maxRetries } : {}),
			...(opts.idleTimeout !== undefined ? { idleTimeout: opts.idleTimeout } : {}),
			...(opts.connectionTimeout !== undefined
				? { connectionTimeout: opts.connectionTimeout }
				: {}),
		};

		const RedisCtor = this.getRedisConstructor();
		for (let i = 0; i < this.poolSize; i++) {
			this.pool.push(new RedisCtor(this.url, this.clientOptions));
		}
	}

	private getRedisConstructor(): typeof Bun.RedisClient {
		const bunGlobal = (globalThis as unknown as { Bun?: { RedisClient?: typeof Bun.RedisClient } })
			.Bun;
		if (bunGlobal?.RedisClient) {
			return bunGlobal.RedisClient;
		}
		throw new Error('Native Bun.redis / Bun.RedisClient is not available in this environment');
	}

	private getClient(): Bun.RedisClient {
		if (this.isClosed || this.pool.length === 0) {
			throw new Error('RedisService is closed or uninitialized');
		}
		const client = this.pool[this.poolIndex % this.pool.length];
		if (!client) {
			throw new Error('Redis client unavailable in pool');
		}
		this.poolIndex = (this.poolIndex + 1) % this.pool.length;
		return client;
	}

	private getSubscriberClient(): Bun.RedisClient {
		if (!this.subscriberClient) {
			const RedisCtor = this.getRedisConstructor();
			this.subscriberClient = new RedisCtor(this.url, this.clientOptions);
		}
		return this.subscriberClient;
	}

	get connected(): boolean {
		return !this.isClosed;
	}

	get isConnected(): boolean {
		return !this.isClosed;
	}

	async get(key: string): Promise<string | null> {
		return await this.getClient().get(key);
	}

	async set(
		key: string,
		value: string,
		options?: SetOptions | number,
	): Promise<'OK' | string | null> {
		const args: (string | number)[] = [key, value];
		if (typeof options === 'number') {
			args.push('EX', options);
		} else if (options) {
			if (options.ex !== undefined) args.push('EX', options.ex);
			else if (options.px !== undefined) args.push('PX', options.px);
			if (options.nx) args.push('NX');
			if (options.xx) args.push('XX');
		}
		const res = await this.getClient().send('SET', args);
		return (res as 'OK' | string | null) ?? null;
	}

	async del(...keys: string[]): Promise<number> {
		if (keys.length === 0) return 0;
		const res = await this.getClient().send('DEL', keys);
		return Number(res ?? 0);
	}

	async exists(...keys: string[]): Promise<number> {
		if (keys.length === 0) return 0;
		const res = await this.getClient().send('EXISTS', keys);
		return Number(res ?? 0);
	}

	async expire(key: string, seconds: number): Promise<number> {
		const res = await this.getClient().send('EXPIRE', [key, String(seconds)]);
		return Number(res ?? 0);
	}

	async ttl(key: string): Promise<number> {
		const res = await this.getClient().send('TTL', [key]);
		return Number(res ?? -2);
	}

	async incr(key: string): Promise<number> {
		const res = await this.getClient().send('INCR', [key]);
		return Number(res ?? 0);
	}

	async eval<T = unknown>(script: string, keys: string[], args: (string | number)[]): Promise<T> {
		const flatArgs: (string | number)[] = [script, keys.length, ...keys, ...args];
		const res = await this.getClient().send('EVAL', flatArgs);
		return res as T;
	}

	async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
		const LUA_INCR_EXPIRE = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl == -1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;
		const res = await this.eval<number>(LUA_INCR_EXPIRE, [key], [ttlSeconds]);
		return Number(res);
	}

	async publish(channel: string, message: string): Promise<number> {
		const res = await this.getClient().send('PUBLISH', [channel, message]);
		return Number(res ?? 0);
	}

	async subscribe(channel: string, handler: PubSubHandler): Promise<UnsubscribeFn> {
		if (this.isClosed) throw new Error('RedisService is closed');
		let handlers = this.subscribers.get(channel);
		const isFirstHandler = !handlers || handlers.size === 0;
		if (!handlers) {
			handlers = new Set();
			this.subscribers.set(channel, handlers);
		}
		handlers.add(handler);

		if (isFirstHandler) {
			const sub = this.getSubscriberClient();
			await sub.subscribe(channel, (msg, ch) => {
				const currentHandlers = this.subscribers.get(ch);
				if (currentHandlers) {
					for (const fn of currentHandlers) {
						try {
							const res = fn(msg, ch);
							if (res instanceof Promise) {
								res.catch(() => {});
							}
						} catch {
							// prevent handler error from affecting others
						}
					}
				}
			});
		}

		return async () => {
			await this.unsubscribe(channel, handler);
		};
	}

	async unsubscribe(channel: string, handler?: PubSubHandler): Promise<void> {
		const handlers = this.subscribers.get(channel);
		if (!handlers) return;
		if (handler) {
			handlers.delete(handler);
		} else {
			handlers.clear();
		}

		if (handlers.size === 0) {
			this.subscribers.delete(channel);
			if (this.subscriberClient) {
				try {
					await this.subscriberClient.unsubscribe(channel);
				} catch {
					// ignore
				}
			}
		}
	}

	async send(
		command: string,
		...args: (string | number | (string | number)[])[]
	): Promise<unknown> {
		const flatArgs = args.flat().map(String);
		return await this.getClient().send(command, flatArgs);
	}

	async sendRaw(line: string): Promise<string> {
		const parts = line.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '';
		const cmd = parts[0];
		if (!cmd) return '';
		const cmdArgs = parts.slice(1);
		const res = await this.send(cmd, ...cmdArgs);
		return String(res ?? '');
	}

	async close(): Promise<void> {
		if (this.isClosed) return;
		this.isClosed = true;
		for (const client of this.pool) {
			try {
				client.close();
			} catch {
				// ignore
			}
		}
		this.pool.length = 0;
		if (this.subscriberClient) {
			try {
				await this.subscriberClient.unsubscribe();
				this.subscriberClient.close();
			} catch {
				// ignore
			}
			this.subscriberClient = null;
		}
		this.subscribers.clear();
	}
}

interface MockStorageEntry {
	value: string;
	expiresAt?: number;
}

export class MockRedisService implements RedisService {
	private readonly storage = new Map<string, MockStorageEntry>();
	private readonly subscribers = new Map<string, Set<PubSubHandler>>();
	private isClosed = false;

	public readonly calls: { command: string; args: unknown[] }[] = [];

	get connected(): boolean {
		return !this.isClosed;
	}

	get isConnected(): boolean {
		return !this.isClosed;
	}

	private cleanIfExpired(key: string): boolean {
		const entry = this.storage.get(key);
		if (!entry) return true;
		if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
			this.storage.delete(key);
			return true;
		}
		return false;
	}

	async get(key: string): Promise<string | null> {
		if (this.cleanIfExpired(key)) return null;
		return this.storage.get(key)?.value ?? null;
	}

	async set(
		key: string,
		value: string,
		options?: SetOptions | number,
	): Promise<'OK' | string | null> {
		this.cleanIfExpired(key);
		const exists = this.storage.has(key);

		if (typeof options === 'object' && options !== null) {
			if (options.nx && exists) return null;
			if (options.xx && !exists) return null;
		}

		let expiresAt: number | undefined;
		if (typeof options === 'number') {
			expiresAt = Date.now() + options * 1000;
		} else if (options) {
			if (options.ex !== undefined) expiresAt = Date.now() + options.ex * 1000;
			else if (options.px !== undefined) expiresAt = Date.now() + options.px;
		}

		this.storage.set(key, { value, expiresAt });
		return 'OK';
	}

	async del(...keys: string[]): Promise<number> {
		let count = 0;
		for (const key of keys) {
			if (!this.cleanIfExpired(key)) {
				this.storage.delete(key);
				count++;
			}
		}
		return count;
	}

	async exists(...keys: string[]): Promise<number> {
		let count = 0;
		for (const key of keys) {
			if (!this.cleanIfExpired(key)) {
				count++;
			}
		}
		return count;
	}

	async expire(key: string, seconds: number): Promise<number> {
		if (this.cleanIfExpired(key)) return 0;
		const entry = this.storage.get(key);
		if (!entry) return 0;
		entry.expiresAt = Date.now() + seconds * 1000;
		return 1;
	}

	async ttl(key: string): Promise<number> {
		if (this.cleanIfExpired(key)) return -2;
		const entry = this.storage.get(key);
		if (!entry) return -2;
		if (entry.expiresAt === undefined) return -1;
		return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
	}

	async incr(key: string): Promise<number> {
		this.cleanIfExpired(key);
		const entry = this.storage.get(key);
		if (!entry) {
			this.storage.set(key, { value: '1' });
			return 1;
		}
		const next = Number(entry.value) + 1;
		entry.value = String(next);
		return next;
	}

	async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
		this.cleanIfExpired(key);
		const now = Date.now();
		const entry = this.storage.get(key);
		if (!entry) {
			this.storage.set(key, { value: '1', expiresAt: now + ttlSeconds * 1000 });
			return 1;
		}
		const next = Number(entry.value) + 1;
		entry.value = String(next);
		if (entry.expiresAt === undefined) {
			entry.expiresAt = now + ttlSeconds * 1000;
		}
		return next;
	}

	async eval<T = unknown>(_script: string, keys: string[], args: (string | number)[]): Promise<T> {
		if (keys[0] && args[0] !== undefined) {
			const res = await this.incrWithExpire(keys[0], Number(args[0]));
			return res as T;
		}
		return 0 as T;
	}

	async publish(channel: string, message: string): Promise<number> {
		const handlers = this.subscribers.get(channel);
		if (!handlers || handlers.size === 0) return 0;
		for (const fn of handlers) {
			try {
				const res = fn(message, channel);
				if (res instanceof Promise) res.catch(() => {});
			} catch {
				// ignore
			}
		}
		return handlers.size;
	}

	async subscribe(channel: string, handler: PubSubHandler): Promise<UnsubscribeFn> {
		let handlers = this.subscribers.get(channel);
		if (!handlers) {
			handlers = new Set();
			this.subscribers.set(channel, handlers);
		}
		handlers.add(handler);
		return async () => {
			await this.unsubscribe(channel, handler);
		};
	}

	async unsubscribe(channel: string, handler?: PubSubHandler): Promise<void> {
		const handlers = this.subscribers.get(channel);
		if (!handlers) return;
		if (handler) {
			handlers.delete(handler);
		} else {
			handlers.clear();
		}
		if (handlers.size === 0) {
			this.subscribers.delete(channel);
		}
	}

	async send(
		command: string,
		...args: (string | number | (string | number)[])[]
	): Promise<unknown> {
		const flatArgs = args.flat().map(String);
		this.calls.push({ command: command.toUpperCase(), args: flatArgs });
		const cmd = command.toUpperCase();

		if (cmd === 'INCR') {
			const key = flatArgs[0] ?? '';
			const val = await this.incr(key);
			return String(val);
		}
		if (cmd === 'EXPIRE') {
			const key = flatArgs[0] ?? '';
			const ttl = Number(flatArgs[1] ?? 0);
			const val = await this.expire(key, ttl);
			return String(val);
		}
		if (cmd === 'GET') {
			return await this.get(flatArgs[0] ?? '');
		}
		if (cmd === 'SET') {
			const key = flatArgs[0] ?? '';
			const val = flatArgs[1] ?? '';
			let opts: SetOptions | undefined;
			const exIdx = flatArgs.indexOf('EX');
			if (exIdx !== -1 && flatArgs[exIdx + 1]) {
				opts = { ex: Number(flatArgs[exIdx + 1]) };
			}
			return await this.set(key, val, opts);
		}
		if (cmd === 'DEL') {
			return await this.del(...flatArgs);
		}
		if (cmd === 'EXISTS') {
			return await this.exists(...flatArgs);
		}
		if (cmd === 'TTL') {
			return await this.ttl(flatArgs[0] ?? '');
		}
		if (cmd === 'PUBLISH') {
			return await this.publish(flatArgs[0] ?? '', flatArgs[1] ?? '');
		}
		if (cmd === 'PING') {
			return 'PONG';
		}
		if (cmd === 'EVAL') {
			const script = flatArgs[0] ?? '';
			const keyCount = Number(flatArgs[1] ?? 0);
			const keys = flatArgs.slice(2, 2 + keyCount);
			const evalArgs = flatArgs.slice(2 + keyCount);
			return await this.eval(script, keys, evalArgs);
		}
		return 'OK';
	}

	async sendRaw(line: string): Promise<string> {
		const parts = line.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '';
		const cmd = parts[0];
		if (!cmd) return '';
		const cmdArgs = parts.slice(1);
		const res = await this.send(cmd, ...cmdArgs);
		return String(res ?? '');
	}

	close(): void {
		this.isClosed = true;
		this.storage.clear();
		this.subscribers.clear();
	}
}

export function createRedisService(options?: BunRedisOptions | string): RedisService {
	return new BunRedisService(options);
}

export async function createRedisConnection(redisUrl: string): Promise<RedisService> {
	return new BunRedisService({ url: redisUrl });
}
