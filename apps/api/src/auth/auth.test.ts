import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createClient, type Sql } from '@together/db';
import { makeApp } from '../app';
import type { MockOtpSender } from './otp-sender';
import type { AuthServices } from './services';

const DB_URL =
	process.env.TEST_DATABASE_URL ??
	'postgresql://together:together@localhost:5433/together_wt4_test';
const JWT_SECRET = 'test-secret';

let sql: Sql;

type App = ReturnType<typeof makeApp>;

function servicesOf(app: App): AuthServices {
	return (app as unknown as { decorator: { services: AuthServices } }).decorator.services;
}

function senderOf(app: App): MockOtpSender {
	return servicesOf(app).otpSender as MockOtpSender;
}

function mkApp(now?: () => Date): App {
	return makeApp({
		databaseUrl: '',
		sql,
		otpProvider: 'mock',
		isProduction: false,
		jwtSecret: JWT_SECRET,
		now,
	});
}

function req(app: App, path: string, init: RequestInit = {}): Promise<Response> {
	return app.handle(new Request(`http://localhost:4004${path}`, init));
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous JSON response bodies
async function readBody(res: Response): Promise<Record<string, any>> {
	// biome-ignore lint/suspicious/noExplicitAny: res.json() is untyped
	return res.json() as Promise<Record<string, any>>;
}

function postJson(
	app: App,
	path: string,
	body: unknown,
	headers: Record<string, string> = {},
): Promise<Response> {
	return req(app, path, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(body),
	});
}

type RegisterResult = {
	status: number;
	// biome-ignore lint/suspicious/noExplicitAny: heterogeneous JSON response body
	body: any;
	otpCode?: string;
};

async function register(app: App, body: unknown): Promise<RegisterResult> {
	const res = await postJson(app, '/auth/register', body);
	return {
		status: res.status,
		body: await readBody(res),
		otpCode: senderOf(app).sent.at(-1)?.code,
	};
}

function refreshTokenOf(res: Response): string {
	const setCookie = res.headers.get('set-cookie') ?? '';
	const match = /refresh=([^;]+)/.exec(setCookie);
	if (match === null) throw new Error('response did not set a refresh cookie');
	return match[1] as string;
}

async function signExpiredToken(secret: string, sub: string, sid: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(JSON.stringify({ sub, sid, iat: 0, exp: -1 })).toString('base64url');
	const input = `${header}.${payload}`;
	const signature = Buffer.from(
		await crypto.subtle.sign('HMAC', key, encoder.encode(input)),
	).toString('base64url');
	return `${input}.${signature}`;
}

beforeAll(async () => {
	sql = createClient(DB_URL);
});

afterAll(async () => {
	await sql.end();
});

beforeEach(async () => {
	await sql`TRUNCATE otp_tokens, sessions, users CASCADE`;
});

describe('GET /health', () => {
	test('returns 200 { status: ok }', async () => {
		const app = mkApp();
		const res = await req(app, '/health');
		expect(res.status).toBe(200);
		expect(await readBody(res)).toEqual({ status: 'ok' });
	});
});

describe('POST /auth/register', () => {
	test('unknown routes return 404 JSON', async () => {
		const app = mkApp();
		const res = await req(app, '/does-not-exist');
		expect(res.status).toBe(404);
	});

	test('validates email, phone, password and rejects unknown fields', async () => {
		const app = mkApp();
		const cases: Array<{ body: Record<string, unknown>; field: string }> = [
			{ body: { email: 'not-an-email', password: 'password123' }, field: 'email' },
			{ body: { email: 'ok@x.com', password: 'short' }, field: 'password' },
			{
				body: { email: 'ok@x.com', password: 'password123', phone: '08012345678' },
				field: 'phone',
			},
			{ body: { name: 'Bob', email: 'ok@x.com', password: 'password123' }, field: 'name' },
		];
		for (const { body, field } of cases) {
			const res = await postJson(app, '/auth/register', body);
			expect(res.status).toBe(400);
			const json = await readBody(res);
			expect(json.error).toBe('VALIDATION');
			expect(json.fields).toHaveProperty(field);
		}
	});

	test('empty body names missing required fields', async () => {
		const app = mkApp();
		const res = await postJson(app, '/auth/register', {});
		expect(res.status).toBe(400);
		const json = await readBody(res);
		expect(json.error).toBe('VALIDATION');
		expect(json.fields).toMatchObject({ email: 'required', password: 'required' });
	});

	test('normalizes email, stores argon2id hashes, creates no profile row, sends OTP', async () => {
		const app = mkApp();
		const { status, body, otpCode } = await register(app, {
			email: '  Ada@X.com ',
			password: 'password123',
			phone: '+2348012345678',
		});
		expect(status).toBe(201);
		expect(body.email).toBe('ada@x.com');
		expect(body.phone).toBe('+2348012345678');
		expect(body).toHaveProperty('id');
		expect(body).toHaveProperty('emailVerified', false);
		expect(body).toHaveProperty('phoneVerified', false);
		expect(body).not.toHaveProperty('password_hash');

		const users = await sql<
			{ email: string; password_hash: string; phone: string }[]
		>`SELECT email, password_hash, phone FROM users`;
		expect(users).toHaveLength(1);
		expect(users[0]?.email).toBe('ada@x.com');
		expect(users[0]?.phone).toBe('+2348012345678');
		expect(users[0]?.password_hash).toStartWith('$argon2id$');

		const profiles = await sql`SELECT count(*)::int AS count FROM profiles`;
		expect(profiles[0]?.count).toBe(0);

		const otps = await sql<
			{ code_hash: string; context: string }[]
		>`SELECT code_hash, context FROM otp_tokens`;
		expect(otps).toHaveLength(1);
		expect(otps[0]?.code_hash).toStartWith('$argon2id$');
		expect(otps[0]?.context).toBe('verify');
		expect(otpCode).toMatch(/^\d{6}$/);
	});

	test('registering without a phone sends no OTP', async () => {
		const app = mkApp();
		const { status } = await register(app, { email: 'no.phone@x.com', password: 'password123' });
		expect(status).toBe(201);
		const otps = await sql`SELECT count(*)::int AS count FROM otp_tokens`;
		expect(otps[0]?.count).toBe(0);
	});

	test('duplicate email in any casing/whitespace returns 409 EMAIL_TAKEN and keeps user count at 1', async () => {
		const app = mkApp();
		const first = await register(app, { email: 'ada@x.com', password: 'password123' });
		expect(first.status).toBe(201);

		for (const email of ['ada@x.com', 'ADA@X.COM', '  ada@x.com  ', 'aDa@X.Com']) {
			const res = await postJson(app, '/auth/register', { email, password: 'password123' });
			expect(res.status).toBe(409);
			const json = await readBody(res);
			expect(json.error).toBe('EMAIL_TAKEN');
		}

		const count = await sql`SELECT count(*)::int AS count FROM users`;
		expect(count[0]?.count).toBe(1);
	});

	test('duplicate phone returns 409 PHONE_TAKEN', async () => {
		const app = mkApp();
		const first = await register(app, {
			email: 'one@x.com',
			password: 'password123',
			phone: '+2348012345678',
		});
		expect(first.status).toBe(201);

		const res = await postJson(app, '/auth/register', {
			email: 'two@x.com',
			password: 'password123',
			phone: '+2348012345678',
		});
		expect(res.status).toBe(409);
		const json = await readBody(res);
		expect(json.error).toBe('PHONE_TAKEN');
		expect(json.fields).toEqual({ phone: 'taken' });

		const count = await sql`SELECT count(*)::int AS count FROM users`;
		expect(count[0]?.count).toBe(1);
	});
});

describe('OTP send and verify', () => {
	test('verify-otp sets phone_verified and a used code cannot be replayed', async () => {
		const app = mkApp();
		const { body, otpCode } = await register(app, {
			email: 'user@x.com',
			password: 'password123',
			phone: '+2348012345678',
		});

		const verifyRes = await postJson(app, '/auth/verify-otp', { phone: body.phone, code: otpCode });
		expect(verifyRes.status).toBe(200);
		expect(await readBody(verifyRes)).toEqual({ phoneVerified: true });

		const rows = await sql`SELECT phone_verified FROM users WHERE email = 'user@x.com'`;
		expect(rows[0]?.phone_verified).toBe(true);

		const replay = await postJson(app, '/auth/verify-otp', { phone: body.phone, code: otpCode });
		expect(replay.status).toBe(400);
		expect((await readBody(replay)).error).toBe('OTP_ALREADY_USED');
	});

	test('wrong code returns 401 INVALID_OTP', async () => {
		const app = mkApp();
		const { body } = await register(app, {
			email: 'user@x.com',
			password: 'password123',
			phone: '+2348012345678',
		});
		const res = await postJson(app, '/auth/verify-otp', { phone: body.phone, code: '000000' });
		expect(res.status).toBe(401);
		expect((await readBody(res)).error).toBe('INVALID_OTP');
	});

	test('code past the 5-minute TTL returns 410 OTP_EXPIRED', async () => {
		const base = new Date('2026-01-01T00:00:00Z');
		let now = base;
		const app = mkApp(() => now);

		const { body, otpCode } = await register(app, {
			email: 'user@x.com',
			password: 'password123',
			phone: '+2348012345678',
		});

		now = new Date(base.getTime() + 301_000);
		const res = await postJson(app, '/auth/verify-otp', { phone: body.phone, code: otpCode });
		expect(res.status).toBe(410);
		expect((await readBody(res)).error).toBe('OTP_EXPIRED');
	});

	test('a code with 5 wrong attempts is bricked', async () => {
		const app = mkApp();
		const { body, otpCode } = await register(app, {
			email: 'user@x.com',
			password: 'password123',
			phone: '+2348012345678',
		});

		for (let i = 0; i < 5; i += 1) {
			const res = await postJson(app, '/auth/verify-otp', { phone: body.phone, code: '000000' });
			expect(res.status).toBe(401);
		}
		const bricked = await postJson(app, '/auth/verify-otp', { phone: body.phone, code: otpCode });
		expect(bricked.status).toBe(429);
		expect((await readBody(bricked)).error).toBe('OTP_ATTEMPTS_EXCEEDED');
	});

	test('send to an unknown phone returns 404 PHONE_NOT_FOUND', async () => {
		const app = mkApp();
		const res = await postJson(app, '/auth/otp/send', { phone: '+2348099999999' });
		expect(res.status).toBe(404);
		expect((await readBody(res)).error).toBe('PHONE_NOT_FOUND');
	});

	test('more than one send per 60s per phone returns 429 with Retry-After', async () => {
		const app = mkApp();
		await register(app, { email: 'user@x.com', password: 'password123', phone: '+2348012345678' });

		const first = await postJson(app, '/auth/otp/send', { phone: '+2348012345678' });
		expect(first.status).toBe(200);
		expect(await readBody(first)).toEqual({ sent: true });

		const second = await postJson(app, '/auth/otp/send', { phone: '+2348012345678' });
		expect(second.status).toBe(429);
		expect((await readBody(second)).error).toBe('OTP_RATE_LIMITED');
		expect(Number(second.headers.get('retry-after'))).toBeGreaterThan(0);
	});

	test('send uses verify context until the phone is verified, then login context', async () => {
		const app = mkApp();
		const phone = '+2348012345678';
		const { otpCode } = await register(app, {
			email: 'user@x.com',
			password: 'password123',
			phone,
		});

		const afterRegister = await sql<{ context: string }[]>`SELECT context FROM otp_tokens`;
		expect(afterRegister[0]?.context).toBe('verify');

		await postJson(app, '/auth/verify-otp', { phone, code: otpCode });
		await postJson(app, '/auth/otp/send', { phone });

		const afterLogin = await sql<{ context: string }[]>`SELECT context FROM otp_tokens`;
		expect(afterLogin[0]?.context).toBe('login');
	});
});

describe('POST /auth/login', () => {
	async function verifiedUser(app: App) {
		const phone = '+2348012345678';
		const { body, otpCode } = await register(app, {
			email: 'user@x.com',
			password: 'password123',
			phone,
		});
		const verify = await postJson(app, '/auth/verify-otp', { phone, code: otpCode });
		expect(verify.status).toBe(200);
		return body as { id: string; email: string; phone: string };
	}

	test('email + password on a verified account returns token, user and refresh cookie', async () => {
		const app = mkApp();
		const user = await verifiedUser(app);

		const res = await postJson(app, '/auth/login', {
			email: 'user@x.com',
			password: 'password123',
		});
		expect(res.status).toBe(200);
		const json = await readBody(res);
		expect(json.token).toBeTruthy();
		expect(json.user.email).toBe('user@x.com');
		expect(json.user.id).toBe(user.id);

		const payload = JSON.parse(
			Buffer.from((json.token as string).split('.')[1] as string, 'base64url').toString(),
		);
		expect(payload.sub).toBe(user.id);
		expect(typeof payload.sid).toBe('string');
		expect(typeof payload.iat).toBe('number');
		expect(payload.exp - payload.iat).toBe(900);

		const setCookie = res.headers.get('set-cookie') ?? '';
		expect(setCookie).toContain('HttpOnly');
		expect(setCookie).toContain('SameSite=Lax');
		expect(setCookie).toContain('Path=/auth');
		expect(setCookie).toContain('Max-Age=2592000');
		expect(setCookie).not.toContain('Secure');
	});

	test('refresh cookie is Secure in production', async () => {
		const app = makeApp({
			databaseUrl: '',
			sql,
			otpProvider: 'mock',
			isProduction: true,
			jwtSecret: JWT_SECRET,
		});
		const phone = '+2348012345678';
		const { otpCode } = await register(app, {
			email: 'user@x.com',
			password: 'password123',
			phone,
		});
		await postJson(app, '/auth/verify-otp', { phone, code: otpCode });

		const res = await postJson(app, '/auth/login', {
			email: 'user@x.com',
			password: 'password123',
		});
		expect(res.headers.get('set-cookie') ?? '').toContain('Secure');
	});

	test('wrong password and unknown email return the same 401 body', async () => {
		const app = mkApp();
		await verifiedUser(app);

		const wrong = await postJson(app, '/auth/login', {
			email: 'user@x.com',
			password: 'wrongpass',
		});
		const unknown = await postJson(app, '/auth/login', {
			email: 'nobody@x.com',
			password: 'wrongpass',
		});
		expect(wrong.status).toBe(401);
		expect(unknown.status).toBe(401);
		const wrongBody = await readBody(wrong);
		const unknownBody = await readBody(unknown);
		expect(wrongBody).toMatchObject({ error: 'INVALID_CREDENTIALS' });
		expect(wrongBody).toEqual(unknownBody);
	});

	test('email login for an unverified phone returns 403 PHONE_NOT_VERIFIED', async () => {
		const app = mkApp();
		await register(app, { email: 'user@x.com', password: 'password123', phone: '+2348012345678' });

		const res = await postJson(app, '/auth/login', {
			email: 'user@x.com',
			password: 'password123',
		});
		expect(res.status).toBe(403);
		expect((await readBody(res)).error).toBe('PHONE_NOT_VERIFIED');
	});

	test('login for an absent phone returns 403 PHONE_NOT_VERIFIED', async () => {
		const app = mkApp();
		const res = await postJson(app, '/auth/login', { phone: '+2348099999999', code: '123456' });
		expect(res.status).toBe(403);
		expect((await readBody(res)).error).toBe('PHONE_NOT_VERIFIED');
	});

	test('phone + code login works on a verified account', async () => {
		const app = mkApp();
		await verifiedUser(app);
		await postJson(app, '/auth/otp/send', { phone: '+2348012345678' });
		const code = senderOf(app).sent.at(-1)?.code;

		const res = await postJson(app, '/auth/login', { phone: '+2348012345678', code });
		expect(res.status).toBe(200);
		const json = await readBody(res);
		expect(json.token).toBeTruthy();
		expect(json.user.email).toBe('user@x.com');
	});

	test('phone + code login cannot replay a used code', async () => {
		const app = mkApp();
		await verifiedUser(app);
		await postJson(app, '/auth/otp/send', { phone: '+2348012345678' });
		const code = senderOf(app).sent.at(-1)?.code;
		expect((await postJson(app, '/auth/login', { phone: '+2348012345678', code })).status).toBe(
			200,
		);

		const replay = await postJson(app, '/auth/login', { phone: '+2348012345678', code });
		expect(replay.status).toBe(400);
		expect((await readBody(replay)).error).toBe('OTP_ALREADY_USED');
	});

	test('more than 10 login attempts per IP+email in 60s returns 429 with Retry-After', async () => {
		const app = mkApp();
		await verifiedUser(app);
		const ip = '10.0.0.7';

		for (let i = 0; i < 10; i += 1) {
			const res = await postJson(
				app,
				'/auth/login',
				{ email: 'user@x.com', password: 'wrongpass' },
				{ 'x-forwarded-for': ip },
			);
			expect(res.status).toBe(401);
		}
		const blocked = await postJson(
			app,
			'/auth/login',
			{ email: 'user@x.com', password: 'wrongpass' },
			{ 'x-forwarded-for': ip },
		);
		expect(blocked.status).toBe(429);
		const json = await readBody(blocked);
		expect(json.error).toBe('LOGIN_RATE_LIMITED');
		expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
	});
});

describe('GET /auth/me', () => {
	async function login(app: App) {
		const phone = '+2348012345678';
		const { body, otpCode } = await register(app, {
			email: 'user@x.com',
			password: 'password123',
			phone,
		});
		await postJson(app, '/auth/verify-otp', { phone, code: otpCode });
		const res = await postJson(app, '/auth/login', {
			email: 'user@x.com',
			password: 'password123',
		});
		const json = await readBody(res);
		return { token: json.token as string, user: body as { id: string; email: string } };
	}

	test('returns the current user with a valid token', async () => {
		const app = mkApp();
		const { token, user } = await login(app);

		const res = await req(app, '/auth/me', { headers: { authorization: `Bearer ${token}` } });
		expect(res.status).toBe(200);
		const json = await readBody(res);
		expect(json).toMatchObject({
			id: user.id,
			email: 'user@x.com',
			emailVerified: false,
			phoneVerified: true,
		});
	});

	test('missing, malformed and expired tokens return 401', async () => {
		const app = mkApp();
		const { user } = await login(app);
		expect((await req(app, '/auth/me')).status).toBe(401);
		expect(
			(await req(app, '/auth/me', { headers: { authorization: 'Bearer not-a-jwt' } })).status,
		).toBe(401);
		expect(
			(
				await req(app, '/auth/me', {
					headers: {
						authorization: `Bearer ${await signExpiredToken(JWT_SECRET, user.id, 'sid')}`,
					},
				})
			).status,
		).toBe(401);
	});
});

describe('POST /auth/refresh and logout', () => {
	async function login(app: App) {
		const phone = '+2348012345678';
		const { otpCode } = await register(app, {
			email: 'user@x.com',
			password: 'password123',
			phone,
		});
		await postJson(app, '/auth/verify-otp', { phone, code: otpCode });
		const res = await postJson(app, '/auth/login', {
			email: 'user@x.com',
			password: 'password123',
		});
		expect(res.status).toBe(200);
		return { refresh: refreshTokenOf(res), res };
	}

	test('refresh rotates the token and kills the old one', async () => {
		const app = mkApp();
		const { refresh } = await login(app);

		const first = await postJson(app, '/auth/refresh', undefined, { cookie: `refresh=${refresh}` });
		expect(first.status).toBe(200);
		const json = await readBody(first);
		expect(json.token).toBeTruthy();
		expect(json.user.email).toBe('user@x.com');
		const newRefresh = refreshTokenOf(first);
		expect(newRefresh).not.toBe(refresh);

		const sessions = await sql`SELECT count(*)::int AS count FROM sessions`;
		expect(sessions[0]?.count).toBe(1);

		const oldRefresh = await postJson(app, '/auth/refresh', undefined, {
			cookie: `refresh=${refresh}`,
		});
		expect(oldRefresh.status).toBe(401);
		expect((await readBody(oldRefresh)).error).toBe('UNAUTHORIZED');
	});

	test('refresh with a garbage cookie returns 401', async () => {
		const app = mkApp();
		const res = await postJson(app, '/auth/refresh', undefined, { cookie: 'refresh=garbage' });
		expect(res.status).toBe(401);
	});

	test('logout deletes the session, clears the cookie and bricks the refresh token', async () => {
		const app = mkApp();
		const { refresh } = await login(app);

		const logout = await postJson(app, '/auth/logout', undefined, { cookie: `refresh=${refresh}` });
		expect(logout.status).toBe(204);
		expect(logout.headers.get('set-cookie') ?? '').toContain('Path=/auth');

		const sessions = await sql`SELECT count(*)::int AS count FROM sessions`;
		expect(sessions[0]?.count).toBe(0);

		const after = await postJson(app, '/auth/refresh', undefined, { cookie: `refresh=${refresh}` });
		expect(after.status).toBe(401);
		expect((await readBody(after)).error).toBe('UNAUTHORIZED');
	});
});
