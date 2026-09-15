import type { Socket } from 'bun';

export interface RedisConnection {
	send(command: string, ...args: string[]): Promise<string>;
	sendRaw(line: string): Promise<string>;
	close(): void;
	readonly connected: boolean;
}

function encodeResp(args: string[]): string {
	let out = `*${args.length}\r\n`;
	for (const arg of args) {
		const bytes = Buffer.byteLength(arg);
		out += `$${bytes}\r\n${arg}\r\n`;
	}
	return out;
}

export async function createRedisConnection(redisUrl: string): Promise<RedisConnection> {
	const url = new URL(redisUrl);
	const host = url.hostname || '127.0.0.1';
	const port = Number(url.port) || 6379;
	const password = url.password || undefined;

	let socket: Socket | null = null;
	let connected = false;
	let idCounter = 0;
	const pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>();
	let readBuffer = Buffer.alloc(0);

	function connect() {
		return new Promise<void>((resolve, reject) => {
			socket = Bun.connect({
				hostname: host,
				port,
				socket: {
					data(_socket, data) {
						readBuffer = Buffer.concat([readBuffer, data]);
						while (true) {
							const result = tryParseResp(readBuffer);
							if (result === null) break;
							const { value, consumed } = result;
							readBuffer = readBuffer.subarray(consumed);
							const entry = pending.values().next().value;
							if (entry) {
								const firstKey = pending.keys().next().value;
								if (firstKey !== undefined) pending.delete(firstKey);
								entry.resolve(value);
							}
						}
					},
					open(_socket) {
						connected = true;
						if (password) {
							sendRawInternal(`AUTH ${password}`)
								.then(() => resolve())
								.catch(reject);
						} else {
							resolve();
						}
					},
					error(_socket, err) {
						connected = false;
						for (const entry of pending.values()) {
							entry.reject(new Error(String(err)));
						}
						pending.clear();
					},
					close() {
						connected = false;
						for (const entry of pending.values()) {
							entry.reject(new Error('Connection closed'));
						}
						pending.clear();
					},
				},
			});
		});
	}

	function tryParseResp(buf: Buffer): { value: string; consumed: number } | null {
		const str = buf.toString('utf-8');
		const lines = str.split('\r\n');
		if (lines.length === 0) return null;
		const first = lines[0];
		if (!first || first.length === 0) return null;

		if (first.startsWith('+') || first.startsWith('-') || first.startsWith(':')) {
			return { value: first.slice(1), consumed: Buffer.byteLength(`${first}\r\n`) };
		}
		if (first.startsWith('$')) {
			const len = parseInt(first.slice(1), 10);
			if (len === -1) return { value: '', consumed: Buffer.byteLength('$-1\r\n') };
			const headerEnd = Buffer.byteLength(`${first}\r\n`);
			const totalNeeded = headerEnd + len + 2;
			if (buf.length < totalNeeded) return null;
			const value = buf.subarray(headerEnd, headerEnd + len).toString('utf-8');
			return { value, consumed: totalNeeded };
		}
		// Array / multi-bulk: count lines until we have enough
		if (first.startsWith('*')) {
			const count = parseInt(first.slice(1), 10);
			if (count === -1) return { value: '', consumed: Buffer.byteLength('*-1\r\n') };
			let offset = Buffer.byteLength(`${first}\r\n`);
			let lastValue = '';
			for (let i = 0; i < count; i++) {
				const sub = buf.subarray(offset);
				const parsed = tryParseResp(sub);
				if (parsed === null) return null;
				lastValue = parsed.value;
				offset += parsed.consumed;
			}
			return { value: lastValue, consumed: offset };
		}
		return null;
	}

	function sendRawInternal(line: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const id = ++idCounter;
			pending.set(id, { resolve, reject });
			if (socket) {
				socket.write(`${line}\r\n`);
			} else {
				reject(new Error('Not connected'));
			}
		});
	}

	await connect();

	return {
		get connected() {
			return connected;
		},
		async send(command: string, ...args: string[]): Promise<string> {
			return sendRawInternal(encodeResp([command, ...args]).trimEnd());
		},
		async sendRaw(line: string): Promise<string> {
			return sendRawInternal(line);
		},
		close() {
			if (socket) {
				socket.end();
				socket = null;
			}
			connected = false;
		},
	};
}
