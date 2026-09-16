import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq, getDatabase, getPool, migrate } from '@together/db';
import { users } from '@together/db/schema';
import { makeApp } from '../../app';
import type { MockOtpSender } from '../auth/otp-sender';
import type { AuthServices } from '../auth/services';

const DB_URL =
	process.env.TEST_DATABASE_URL ??
	'postgresql://together:together@localhost:5433/together_wt18_test';
const JWT_SECRET = 'test-secret';

type App = ReturnType<typeof makeApp>;

function servicesOf(app: App): AuthServices {
	return (app as unknown as { decorator: { services: AuthServices } }).decorator.services;
}

function senderOf(app: App): MockOtpSender {
	return servicesOf(app).otpSender as MockOtpSender;
}

function mkApp(): App {
	return makeApp({
		databaseUrl: DB_URL,
		db: getDatabase(),
		otpProvider: 'mock',
		isProduction: false,
		jwtSecret: JWT_SECRET,
	});
}

function req(app: App, path: string, init: RequestInit = {}): Promise<Response> {
	return app.handle(new Request(`http://localhost:4018${path}`, init));
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

function get(app: App, path: string, token?: string): Promise<Response> {
	const headers: Record<string, string> = {};
	if (token !== undefined) headers.authorization = `Bearer ${token}`;
	return req(app, path, { headers });
}

async function loginToken(app: App, email: string, password: string): Promise<string> {
	const res = await postJson(app, '/auth/login', { email, password });
	expect(res.status).toBe(200);
	const body = await readBody(res);
	expect(body.token).toBeTruthy();
	return body.token as string;
}

/** Registers + verifies a phone-verified user, optionally promotes to admin, returns a login token. */
async function verifiedToken(
	app: App,
	input: { email: string; phone: string; admin: boolean },
): Promise<string> {
	const password = 'password123';
	const reg = await postJson(app, '/auth/register', {
		email: input.email,
		password,
		phone: input.phone,
	});
	expect(reg.status).toBe(201);
	const code = senderOf(app).sent.at(-1)?.code;
	expect(code).toMatch(/^\d{6}$/);
	const verify = await postJson(app, '/auth/verify-otp', { phone: input.phone, code });
	expect(verify.status).toBe(200);
	if (input.admin) {
		await getDatabase()
			.update(users)
			.set({ isAdmin: true })
			.where(eq(users.email, input.email.toLowerCase()));
	}
	return loginToken(app, input.email, password);
}

beforeAll(async () => {
	await migrate(DB_URL);
});

describe('GET /admin/reports', () => {
	test('unauthenticated request returns 401', async () => {
		const app = mkApp();
		const res = await get(app, '/admin/reports');
		expect(res.status).toBe(401);
		expect((await readBody(res)).error).toBe('UNAUTHORIZED');
	});

	test('garbage bearer token returns 401, not 403', async () => {
		const app = mkApp();
		const res = await get(app, '/admin/reports', 'not-a-jwt');
		expect(res.status).toBe(401);
		expect((await readBody(res)).error).toBe('UNAUTHORIZED');
	});

	test('valid non-admin token returns 403 ADMIN_ACCESS_REQUIRED', async () => {
		const app = mkApp();
		const token = await verifiedToken(app, {
			email: 'user@x.com',
			phone: '+2348012345678',
			admin: false,
		});
		const res = await get(app, '/admin/reports', token);
		expect(res.status).toBe(403);
		const body = await readBody(res);
		expect(body.error).toBe('ADMIN_ACCESS_REQUIRED');
		expect(body.message).toBe('Admin access required');
	});

	test('admin token returns 200 placeholder queue with no user data', async () => {
		const app = mkApp();
		const token = await verifiedToken(app, {
			email: 'admin@x.com',
			phone: '+2348012345678',
			admin: true,
		});
		const res = await get(app, '/admin/reports', token);
		expect(res.status).toBe(200);
		expect(await readBody(res)).toEqual({ reports: [], total: 0 });
	});

	test('admin is resolved per request: promoting after login grants access', async () => {
		const app = mkApp();
		const token = await verifiedToken(app, {
			email: 'user@x.com',
			phone: '+2348012345678',
			admin: false,
		});
		expect((await get(app, '/admin/reports', token)).status).toBe(403);
		await getDatabase().update(users).set({ isAdmin: true }).where(eq(users.email, 'user@x.com'));
		const res = await get(app, '/admin/reports', token);
		expect(res.status).toBe(200);
	});

	test('suspended admin token returns 401', async () => {
		const app = mkApp();
		const token = await verifiedToken(app, {
			email: 'admin@x.com',
			phone: '+2348012345678',
			admin: true,
		});
		await getDatabase()
			.update(users)
			.set({ status: 'suspended' })
			.where(eq(users.email, 'admin@x.com'));
		const res = await get(app, '/admin/reports', token);
		expect(res.status).toBe(401);
	});
});

describe('GET /admin/me', () => {
	test('unauthenticated request returns 401', async () => {
		const app = mkApp();
		const res = await get(app, '/admin/me');
		expect(res.status).toBe(401);
		expect((await readBody(res)).error).toBe('UNAUTHORIZED');
	});

	test('valid non-admin token returns 403 Admin access required', async () => {
		const app = mkApp();
		const token = await verifiedToken(app, {
			email: 'user@x.com',
			phone: '+2348012345678',
			admin: false,
		});
		const res = await get(app, '/admin/me', token);
		expect(res.status).toBe(403);
		const body = await readBody(res);
		expect(body.error).toBe('ADMIN_ACCESS_REQUIRED');
		expect(body.message).toBe('Admin access required');
	});

	test('admin token returns id/email/isAdmin and no other user-private fields', async () => {
		const app = mkApp();
		const token = await verifiedToken(app, {
			email: 'admin@x.com',
			phone: '+2348012345678',
			admin: true,
		});
		const res = await get(app, '/admin/me', token);
		expect(res.status).toBe(200);
		const body = await readBody(res);
		expect(body.isAdmin).toBe(true);
		expect(body.email).toBe('admin@x.com');
		expect(typeof body.id).toBe('string');
		expect(Object.keys(body).sort()).toEqual(['email', 'id', 'isAdmin']);
	});
});
