import { beforeEach, describe, expect, test } from 'bun:test';
import { adminAuth, createReport, makeTestApp, userAuth } from '../../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

function get(path: string, token?: string): Promise<Response> {
	const headers: Record<string, string> = {};
	if (token !== undefined) headers.authorization = `Bearer ${token}`;
	return app.handle(new Request(`http://localhost${path}`, { headers }));
}

function write(path: string, method: string, token?: string): Promise<Response> {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (token !== undefined) headers.authorization = `Bearer ${token}`;
	return app.handle(new Request(`http://localhost${path}`, { method, headers }));
}

function postAction(reportId: string, token: string, body: unknown): Promise<Response> {
	return app.handle(
		new Request(`http://localhost/admin/reports/${reportId}/action`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify(body),
		}),
	);
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous JSON response bodies
async function readBody(res: Response): Promise<Record<string, any>> {
	// biome-ignore lint/suspicious/noExplicitAny: res.json() is untyped
	return res.json() as Promise<Record<string, any>>;
}

describe('GET /admin/audit-log', () => {
	test('unauthenticated request returns 401', async () => {
		const res = await get('/admin/audit-log');
		expect(res.status).toBe(401);
	});

	test('valid non-admin token returns 403', async () => {
		const { token } = await userAuth();
		const res = await get('/admin/audit-log', token);
		expect(res.status).toBe(403);
		expect((await readBody(res)).error).toBe('ADMIN_ACCESS_REQUIRED');
	});

	test('empty log returns an empty page', async () => {
		const { token } = await adminAuth();
		const res = await get('/admin/audit-log', token);
		expect(res.status).toBe(200);
		expect(await readBody(res)).toEqual({ entries: [], total: 0, page: 1, limit: 25 });
	});

	test('moderation actions appear newest-first with actor, target, reason, timestamp', async () => {
		const admin = await adminAuth();
		const first = await createReport({ reason: 'First' });
		const second = await createReport({ reason: 'Second' });
		await postAction(first.id, admin.token, { action: 'warn', reason: 'First warning' });
		await postAction(second.id, admin.token, { action: 'suspend', reason: 'Bad actor' });

		const body = await readBody(await get('/admin/audit-log', admin.token));
		expect(body.total).toBe(2);
		const [latest, oldest] = body.entries as Record<string, unknown>[];
		expect(latest?.action).toBe('suspend');
		expect(oldest?.action).toBe('warn');
		expect(latest?.actorId).toBe(admin.user.id);
		expect(typeof latest?.actorEmail).toBe('string');
		expect(typeof latest?.createdAt).toBe('string');
		expect(latest?.after).toMatchObject({ reason: 'Bad actor', status: 'resolved' });
		expect(typeof (latest?.after as Record<string, unknown>)?.targetUserId).toBe('string');
	});

	test('action filter selects only suspend entries', async () => {
		const admin = await adminAuth();
		const warned = await createReport({});
		const suspended = await createReport({});
		await postAction(warned.id, admin.token, { action: 'warn' });
		await postAction(suspended.id, admin.token, { action: 'suspend' });

		const body = await readBody(await get('/admin/audit-log?action=suspend', admin.token));
		expect(body.total).toBe(1);
		expect(body.entries[0].action).toBe('suspend');
	});

	test('actor filter and pagination work', async () => {
		const admin = await adminAuth();
		const one = await createReport({});
		const two = await createReport({});
		const three = await createReport({});
		await postAction(one.id, admin.token, { action: 'warn' });
		await postAction(two.id, admin.token, { action: 'warn' });
		await postAction(three.id, admin.token, { action: 'warn' });

		const byActor = await readBody(
			await get(`/admin/audit-log?actorId=${admin.user.id}`, admin.token),
		);
		expect(byActor.total).toBe(3);

		const page2 = await readBody(await get('/admin/audit-log?limit=2&page=2', admin.token));
		expect(page2.total).toBe(3);
		expect(page2.entries).toHaveLength(1);
		expect(page2.page).toBe(2);
		expect(page2.limit).toBe(2);
	});
});

describe('audit log is append-only', () => {
	test('PATCH as admin returns 405, as non-admin returns 403', async () => {
		const admin = await adminAuth();
		const other = await userAuth();
		const { id } = await createReport({});
		await postAction(id, admin.token, { action: 'warn' });
		const { entries } = await readBody(await get('/admin/audit-log', admin.token));
		const entryId = entries[0].id as number;

		const asAdmin = await write(`/admin/audit-log/${entryId}`, 'PATCH', admin.token);
		expect(asAdmin.status).toBe(405);
		expect((await readBody(asAdmin)).error).toBe('METHOD_NOT_ALLOWED');

		const asUser = await write(`/admin/audit-log/${entryId}`, 'PATCH', other.token);
		expect(asUser.status).toBe(403);
	});

	test('DELETE as admin returns 405', async () => {
		const admin = await adminAuth();
		const { id } = await createReport({});
		await postAction(id, admin.token, { action: 'warn' });
		const { entries } = await readBody(await get('/admin/audit-log', admin.token));
		const entryId = entries[0].id as number;

		const res = await write(`/admin/audit-log/${entryId}`, 'DELETE', admin.token);
		expect(res.status).toBe(405);
	});
});
