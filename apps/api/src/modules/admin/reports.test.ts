import { beforeEach, describe, expect, test } from 'bun:test';
import { eq, getDatabase } from '../../infra/database';
import { users } from '../../infra/database/schema';
import {
	adminAuth,
	createReport,
	createRequest,
	createUser,
	makeTestApp,
	userAuth,
} from '../../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

function get(path: string, token?: string): Promise<Response> {
	const headers: Record<string, string> = {};
	if (token !== undefined) headers.authorization = `Bearer ${token}`;
	return app.handle(new Request(`http://localhost${path}`, { headers }));
}

function post(path: string, token: string | undefined, body: unknown): Promise<Response> {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (token !== undefined) headers.authorization = `Bearer ${token}`;
	return app.handle(
		new Request(`http://localhost${path}`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		}),
	);
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous JSON response bodies
async function readBody(res: Response): Promise<Record<string, any>> {
	// biome-ignore lint/suspicious/noExplicitAny: res.json() is untyped
	return res.json() as Promise<Record<string, any>>;
}

describe('GET /admin/reports filtering', () => {
	test('category filter selects only request reports', async () => {
		const { token } = await adminAuth();
		const profileOwner = await createUser();
		await createReport({ subjectType: 'request', reason: 'Bad request' });
		await createReport({ subjectType: 'profile', subjectId: profileOwner.id, reason: 'Bad bio' });

		const res = await get('/admin/reports?category=request', token);
		expect(res.status).toBe(200);
		const body = await readBody(res);
		expect(body.total).toBe(1);
		expect(body.reports[0].reason).toBe('Bad request');
		expect(body.reports[0].category).toBe('request');
	});

	test('status filter and pagination work together', async () => {
		const { token } = await adminAuth();
		await createReport({ reason: 'One', status: 'pending' });
		await createReport({ reason: 'Two', status: 'resolved' });
		await createReport({ reason: 'Three', status: 'pending' });

		const filtered = await readBody(await get('/admin/reports?status=pending', token));
		expect(filtered.total).toBe(2);

		const page2 = await readBody(await get('/admin/reports?limit=2&page=2', token));
		expect(page2.total).toBe(3);
		expect(page2.reports).toHaveLength(1);
	});

	test('invalid status value is rejected', async () => {
		const { token } = await adminAuth();
		const res = await get('/admin/reports?status=bogus', token);
		expect([400, 422]).toContain(res.status);
	});
});

describe('GET /admin/reports/:id', () => {
	test('detail shows the reported request snapshot without reporter identity', async () => {
		const { token } = await adminAuth();
		const requestId = await createRequest({ title: 'Help me move' });
		const { id } = await createReport({
			subjectType: 'request',
			subjectId: requestId,
			reason: 'Looks scammy',
			description: 'No details provided',
		});

		const res = await get(`/admin/reports/${id}`, token);
		expect(res.status).toBe(200);
		const body = await readBody(res);
		expect(body.reason).toBe('Looks scammy');
		expect(body.description).toBe('No details provided');
		expect(body.category).toBe('request');
		expect(body.status).toBe('pending');
		expect(body.subjectId).toBe(requestId);
		expect(body.subjectSnapshot.title).toBe('Help me move');
		expect(body.resolvedBy).toBeNull();
		expect(JSON.stringify(body)).not.toContain('reporterId');
	});

	test('unknown report id returns 404', async () => {
		const { token } = await adminAuth();
		const res = await get('/admin/reports/11111111-1111-4111-8111-111111111111', token);
		expect(res.status).toBe(404);
		expect((await readBody(res)).error).toBe('NOT_FOUND');
	});

	test('non-admin cannot view report detail', async () => {
		const { token } = await userAuth();
		const { id } = await createReport({});
		const res = await get(`/admin/reports/${id}`, token);
		expect(res.status).toBe(403);
	});

	test('message reports resolve to a null snapshot until messaging lands', async () => {
		const { token } = await adminAuth();
		const { id } = await createReport({
			subjectType: 'message',
			subjectId: '33333333-3333-4333-8333-333333333333',
			reason: 'Harassment',
		});
		const res = await get(`/admin/reports/${id}`, token);
		expect(res.status).toBe(200);
		expect((await readBody(res)).subjectSnapshot).toBeNull();
	});

	test('user-targeted action without a resolvable target returns 422', async () => {
		const admin = await adminAuth();
		const { id } = await createReport({
			subjectType: 'message',
			subjectId: '33333333-3333-4333-8333-333333333333',
		});
		const res = await post(`/admin/reports/${id}/action`, admin.token, { action: 'suspend' });
		expect(res.status).toBe(422);
		expect((await readBody(res)).error).toBe('TARGET_NOT_FOUND');
	});
});

describe('POST /admin/reports/:id/action', () => {
	test('warn resolves the report and writes an audit row', async () => {
		const admin = await adminAuth();
		const { id } = await createReport({ reason: 'Rude content' });

		const res = await post(`/admin/reports/${id}/action`, admin.token, { action: 'warn' });
		expect(res.status).toBe(200);
		const body = await readBody(res);
		expect(body.success).toBe(true);
		expect(body.report.status).toBe('resolved');
		expect(body.report.resolvedBy).toBe(admin.user.id);
		expect(typeof body.report.resolvedAt).toBe('string');

		const audit = await readBody(await get('/admin/audit-log?action=warn', admin.token));
		expect(audit.total).toBe(1);
		const [entry] = audit.entries as Record<string, unknown>[];
		expect(entry?.actorId).toBe(admin.user.id);
		expect(entry?.entityType).toBe('report');
		expect(entry?.entityId).toBe(id);
		expect(entry?.after).toMatchObject({ status: 'resolved' });
		expect(typeof entry?.createdAt).toBe('string');
	});

	test('dismiss closes the report without touching the target account', async () => {
		const admin = await adminAuth();
		const target = await createUser();
		const requestId = await createRequest(target.id, {});
		const { id } = await createReport({ subjectType: 'request', subjectId: requestId });

		const res = await post(`/admin/reports/${id}/action`, admin.token, {
			action: 'dismiss',
			reason: 'False report',
		});
		expect(res.status).toBe(200);
		expect((await readBody(res)).report.status).toBe('dismissed');

		const [row] = await getDatabase().select().from(users).where(eq(users.id, target.id));
		expect(row?.status).toBe('active');

		const audit = await readBody(await get('/admin/audit-log?action=dismiss', admin.token));
		expect(audit.total).toBe(1);
		expect(audit.entries[0].after).toMatchObject({ reason: 'False report' });
	});

	test('second action on the same report returns 409 Already resolved', async () => {
		const admin = await adminAuth();
		const { id } = await createReport({});

		const first = await post(`/admin/reports/${id}/action`, admin.token, { action: 'warn' });
		expect(first.status).toBe(200);
		const second = await post(`/admin/reports/${id}/action`, admin.token, { action: 'warn' });
		expect(second.status).toBe(409);
		const body = await readBody(second);
		expect(body.error).toBe('ALREADY_RESOLVED');
		expect(body.message).toBe('Already resolved');
	});

	test('unknown action value is rejected', async () => {
		const admin = await adminAuth();
		const { id } = await createReport({});
		const res = await post(`/admin/reports/${id}/action`, admin.token, { action: 'nuke' });
		expect([400, 422]).toContain(res.status);
	});

	test('non-admin cannot take action', async () => {
		const { token } = await userAuth();
		const { id } = await createReport({});
		const res = await post(`/admin/reports/${id}/action`, token, { action: 'warn' });
		expect(res.status).toBe(403);
	});
});

describe('suspend and restore (issue #19 criterion 8)', () => {
	test('suspended user gets 403 ACCOUNT_SUSPENDED; restore reverses it', async () => {
		const admin = await adminAuth();
		const target = await userAuth();
		const requestId = await createRequest(target.user.id, {});
		const { id } = await createReport({ subjectType: 'request', subjectId: requestId });

		const suspend = await post(`/admin/reports/${id}/action`, admin.token, {
			action: 'suspend',
			reason: 'Abuse',
		});
		expect(suspend.status).toBe(200);

		const [suspended] = await getDatabase()
			.select()
			.from(users)
			.where(eq(users.id, target.user.id));
		expect(suspended?.status).toBe('suspended');

		const blocked = await post('/requests', target.token, {});
		expect(blocked.status).toBe(403);
		expect((await readBody(blocked)).error).toBe('ACCOUNT_SUSPENDED');

		const me = await get('/auth/me', target.token);
		expect(me.status).toBe(403);
		expect((await readBody(me)).error).toBe('ACCOUNT_SUSPENDED');

		const { id: secondId } = await createReport({
			subjectType: 'request',
			subjectId: requestId,
		});
		const restore = await post(`/admin/reports/${secondId}/action`, admin.token, {
			action: 'restore',
		});
		expect(restore.status).toBe(200);

		const [restored] = await getDatabase().select().from(users).where(eq(users.id, target.user.id));
		expect(restored?.status).toBe('active');

		const allowed = await post('/requests', target.token, {});
		expect(allowed.status).toBe(201);
	});
});
