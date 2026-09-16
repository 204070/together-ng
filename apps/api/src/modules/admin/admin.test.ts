import { beforeEach, describe, expect, test } from 'bun:test';
import { eq, getDatabase } from '@together/db';
import { users } from '@together/db/schema';
import { adminAuth, makeTestApp, userAuth } from '../../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

function get(path: string, token?: string): Promise<Response> {
	const headers: Record<string, string> = {};
	if (token !== undefined) headers.authorization = `Bearer ${token}`;
	return app.handle(new Request(`http://localhost${path}`, { headers }));
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous JSON response bodies
async function readBody(res: Response): Promise<Record<string, any>> {
	// biome-ignore lint/suspicious/noExplicitAny: res.json() is untyped
	return res.json() as Promise<Record<string, any>>;
}

describe('GET /admin/reports', () => {
	test('unauthenticated request returns 401', async () => {
		const res = await get('/admin/reports');
		expect(res.status).toBe(401);
		expect((await readBody(res)).error).toBe('UNAUTHORIZED');
	});

	test('garbage bearer token returns 401, not 403', async () => {
		const res = await get('/admin/reports', 'not-a-jwt');
		expect(res.status).toBe(401);
		expect((await readBody(res)).error).toBe('UNAUTHORIZED');
	});

	test('valid non-admin token returns 403 ADMIN_ACCESS_REQUIRED', async () => {
		const { token } = await userAuth({ email: 'user@x.com' });
		const res = await get('/admin/reports', token);
		expect(res.status).toBe(403);
		const body = await readBody(res);
		expect(body.error).toBe('ADMIN_ACCESS_REQUIRED');
		expect(body.message).toBe('Admin access required');
	});

	test('admin token returns 200 placeholder queue with no user data', async () => {
		const { token } = await adminAuth({ email: 'admin@x.com' });
		const res = await get('/admin/reports', token);
		expect(res.status).toBe(200);
		expect(await readBody(res)).toEqual({ reports: [], total: 0 });
	});

	test('admin is resolved per request: promoting after login grants access', async () => {
		const { user, token } = await userAuth({ email: 'user@x.com' });
		expect((await get('/admin/reports', token)).status).toBe(403);
		await getDatabase().update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
		const res = await get('/admin/reports', token);
		expect(res.status).toBe(200);
	});

	test('suspended admin token returns 401', async () => {
		const { user, token } = await adminAuth({ email: 'admin@x.com' });
		await getDatabase().update(users).set({ status: 'suspended' }).where(eq(users.id, user.id));
		const res = await get('/admin/reports', token);
		expect(res.status).toBe(401);
	});
});

describe('GET /admin/me', () => {
	test('unauthenticated request returns 401', async () => {
		const res = await get('/admin/me');
		expect(res.status).toBe(401);
		expect((await readBody(res)).error).toBe('UNAUTHORIZED');
	});

	test('valid non-admin token returns 403 Admin access required', async () => {
		const { token } = await userAuth({ email: 'user@x.com' });
		const res = await get('/admin/me', token);
		expect(res.status).toBe(403);
		const body = await readBody(res);
		expect(body.error).toBe('ADMIN_ACCESS_REQUIRED');
		expect(body.message).toBe('Admin access required');
	});

	test('admin token returns id/email/isAdmin and no other user-private fields', async () => {
		const { user, token } = await adminAuth({ email: 'admin@x.com' });
		const res = await get('/admin/me', token);
		expect(res.status).toBe(200);
		const body = await readBody(res);
		expect(body.isAdmin).toBe(true);
		expect(body.email).toBe('admin@x.com');
		expect(body.id).toBe(user.id);
		expect(Object.keys(body).sort()).toEqual(['email', 'id', 'isAdmin']);
	});
});
