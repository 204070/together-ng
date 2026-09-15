import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createClient, migrate, type Sql } from '@together/db';
import { makeApp } from '../app';
import { createMatchingQueue } from '../queue';
import { recomputeMatches } from './matching';
import { buildNotificationBody, dispatchNotifications } from './notifications';

const DB_URL =
	process.env.TEST_DATABASE_URL ??
	'postgresql://together:together@localhost:5433/together_wt13_test';
const JWT_SECRET = 'test-secret';

let sql: Sql;
let queue: ReturnType<typeof createMatchingQueue>;

type App = ReturnType<typeof makeApp>;

function mkApp(): App {
	return makeApp({
		databaseUrl: '',
		sql,
		otpProvider: 'mock',
		isProduction: false,
		jwtSecret: JWT_SECRET,
		matching: queue.asService(),
	});
}

function req(app: App, path: string, init: RequestInit = {}): Promise<Response> {
	return app.handle(new Request(`http://localhost:4013${path}`, init));
}

let seq = 0;
function unique(prefix: string): string {
	seq += 1;
	return `${prefix}-${Date.now()}-${seq}`;
}

async function createUser(email?: string, isAdmin = false): Promise<{ id: string; email: string }> {
	const address = email ?? `${unique('m')}@example.com`;
	const hash = await Bun.password.hash('password123', { algorithm: 'argon2id' });
	const rows = await sql<{ id: string }[]>`
		INSERT INTO users (email, password_hash, phone_verified, is_admin) VALUES (${address}, ${hash}, true, ${isAdmin}) RETURNING id
	`;
	return { id: rows[0]?.id as string, email: address };
}

async function loginToken(app: App, email: string): Promise<string> {
	const res = await req(app, '/auth/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email, password: 'password123' }),
	});
	expect(res.status).toBe(200);
	const body = (await res.json()) as { token: string };
	return body.token;
}

async function createCategory(slug?: string): Promise<number> {
	const s = slug ?? unique('cat');
	const rows = await sql<{ id: number }[]>`
		INSERT INTO categories (name, slug) VALUES (${s}, ${s}) RETURNING id
	`;
	return rows[0]?.id as number;
}

async function createSkill(categoryId: number, slug?: string): Promise<number> {
	const s = slug ?? unique('skill');
	const rows = await sql<{ id: number }[]>`
		INSERT INTO skills (category_id, name, slug) VALUES (${categoryId}, ${s}, ${s}) RETURNING id
	`;
	return rows[0]?.id as number;
}

async function addCapability(input: {
	userId: string;
	categoryId?: number | null;
	skillId?: number | null;
	modality?: string;
	location?: string | null;
}): Promise<void> {
	await sql`
		INSERT INTO contributor_capabilities (user_id, category_id, skill_id, modality, location)
		VALUES (${input.userId}, ${input.categoryId ?? null}, ${input.skillId ?? null}, ${input.modality ?? 'both'}, ${input.location ?? null})
	`;
}

async function setPrefs(userId: string, patch: Record<string, unknown>): Promise<void> {
	const defaults = {
		notify_new_matches: true,
		notify_remote: true,
		notify_local: true,
		notify_resource_lending: true,
		notify_mentorship: true,
		in_app_enabled: true,
		...patch,
	};
	await sql`
		INSERT INTO notification_preferences
			(user_id, in_app_enabled, notify_new_matches, notify_remote, notify_local, notify_resource_lending, notify_mentorship)
		VALUES (${userId}, ${defaults.in_app_enabled}, ${defaults.notify_new_matches}, ${defaults.notify_remote}, ${defaults.notify_local}, ${defaults.notify_resource_lending}, ${defaults.notify_mentorship})
		ON CONFLICT (user_id) DO UPDATE SET
			in_app_enabled = EXCLUDED.in_app_enabled,
			notify_new_matches = EXCLUDED.notify_new_matches,
			notify_remote = EXCLUDED.notify_remote,
			notify_local = EXCLUDED.notify_local,
			notify_resource_lending = EXCLUDED.notify_resource_lending,
			notify_mentorship = EXCLUDED.notify_mentorship
	`;
}

async function createRequestRow(
	authorId: string,
	fields: {
		categoryId: number | null;
		modality?: string | null;
		helpType?: string | null;
		location?: string | null;
		state?: string;
	},
): Promise<string> {
	const rows = await sql<{ id: string }[]>`
		INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state, modality, help_type, location)
		VALUES (${authorId}, ${fields.categoryId}, 'Help with soldering', 'Learn to solder a simple circuit for a school project', 'No tools and no guidance from anyone nearby', 'Someone patient who can show me the basics', ${fields.state ?? 'published'}, ${fields.modality ?? 'both'}, ${fields.helpType ?? null}, ${fields.location ?? null})
		RETURNING id
	`;
	return rows[0]?.id as string;
}

async function waitForMatchRows(requestId: string, timeoutMs = 5000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const rows = await sql<{ contributor_id: string }[]>`
			SELECT contributor_id FROM request_matches WHERE request_id = ${requestId}
		`;
		if (rows.length > 0) return rows;
		await new Promise((r) => setTimeout(r, 50));
	}
	return sql<{ contributor_id: string }[]>`
		SELECT contributor_id FROM request_matches WHERE request_id = ${requestId}
	`;
}

async function notificationRows(userId: string) {
	return sql<
		{
			id: string;
			user_id: string;
			request_id: string | null;
			type: string;
			title: string;
			body: string | null;
			read_at: Date | null;
		}[]
	>`
		SELECT id, user_id, request_id, type, title, body, read_at
		FROM notifications
		WHERE user_id = ${userId}
		ORDER BY created_at DESC
	`;
}

async function dispatchLogRows(requestId: string) {
	return sql<
		{
			user_id: string;
			decision: string;
			reason: string | null;
			caps_evaluated: unknown;
			cap_window: string | null;
		}[]
	>`
		SELECT user_id, decision, reason, caps_evaluated, cap_window
		FROM notification_dispatch_log
		WHERE request_id = ${requestId}
	`;
}

beforeAll(async () => {
	sql = createClient(DB_URL);
	await migrate(DB_URL);
	queue = createMatchingQueue({ connectionString: DB_URL, sql });
	await queue.start();
});

afterAll(async () => {
	await queue.stop();
	await sql.end();
});

beforeEach(async () => {
	await sql`TRUNCATE users, categories, skills RESTART IDENTITY CASCADE`;
});

describe('notification dispatch worker', () => {
	test('creates notifications for eligible contributors when request has matches', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(sql, requestId);
		const { sent, suppressed } = await dispatchNotifications(sql, requestId);

		expect(sent).toBe(1);
		expect(suppressed).toBe(0);

		const rows = await notificationRows(contributor.id);
		expect(rows.length).toBe(1);
		expect(rows[0]?.type).toBe('new_match');
		expect(rows[0]?.title).toContain('Help with soldering');
		expect(rows[0]?.body).toContain('new match');
		expect(rows[0]?.request_id).toBe(requestId);
	});

	test('notification body contains templated relevance explanation', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		const skillId = await createSkill(categoryId);
		await addCapability({ userId: contributor.id, categoryId, skillId });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(sql, requestId);
		const { sent } = await dispatchNotifications(sql, requestId);

		expect(sent).toBe(1);
		const rows = await notificationRows(contributor.id);
		expect(rows.length).toBe(1);
		expect(rows[0]?.body).toContain('capability match');
	});

	test('no LLM calls on notification path', async () => {
		const { readFileSync } = await import('node:fs');
		const { resolve } = await import('node:path');
		const notificationsSource = readFileSync(resolve(import.meta.dir, 'notifications.ts'), 'utf8');
		expect(notificationsSource).not.toMatch(/claude/i);
		expect(notificationsSource).not.toMatch(/openai/i);
	});

	test('suppressed when category disabled (resource lending)', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const requestId = await createRequestRow(author.id, {
			categoryId,
			helpType: 'borrow',
		});

		await recomputeMatches(sql, requestId);

		// Change preferences AFTER matching to test the notification worker's own check
		await setPrefs(contributor.id, { notify_resource_lending: false });

		const { sent, suppressed } = await dispatchNotifications(sql, requestId);

		expect(sent).toBe(0);
		expect(suppressed).toBe(1);

		const rows = await notificationRows(contributor.id);
		expect(rows.length).toBe(0);

		const logRows = await dispatchLogRows(requestId);
		expect(logRows.length).toBe(1);
		expect(logRows[0]?.decision).toBe('suppressed');
		expect(logRows[0]?.reason).toBe('category_disabled');
	});

	test('suppressed when in_app channel disabled', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		await setPrefs(contributor.id, { in_app_enabled: false });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(sql, requestId);
		const { sent, suppressed } = await dispatchNotifications(sql, requestId);

		expect(sent).toBe(0);
		expect(suppressed).toBe(1);

		const rows = await notificationRows(contributor.id);
		expect(rows.length).toBe(0);

		const logRows = await dispatchLogRows(requestId);
		expect(logRows.length).toBe(1);
		expect(logRows[0]?.decision).toBe('suppressed');
		expect(logRows[0]?.reason).toBe('channel_disabled');
	});

	test('frequency cap: 4 matches within 24h produces only 3 notifications', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });

		for (let i = 0; i < 4; i++) {
			const requestId = await createRequestRow(author.id, { categoryId });
			await recomputeMatches(sql, requestId);
			await dispatchNotifications(sql, requestId);
		}

		const rows = await notificationRows(contributor.id);
		expect(rows.length).toBe(3);

		const allLogRows = await sql<{ user_id: string; decision: string; reason: string | null }[]>`
			SELECT user_id, decision, reason
			FROM notification_dispatch_log
			WHERE user_id = ${contributor.id}
		`;
		const suppressed = allLogRows.filter((r) => r.decision === 'suppressed');
		expect(suppressed.length).toBe(1);
		expect(suppressed[0]?.reason).toBe('frequency_cap_exceeded');
	});

	test('every dispatch attempt creates append-only log row', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(sql, requestId);
		await dispatchNotifications(sql, requestId);

		const logRows = await dispatchLogRows(requestId);
		expect(logRows.length).toBe(1);
		expect(logRows[0]?.user_id).toBe(contributor.id);
		expect(logRows[0]?.decision).toBe('sent');
		expect(logRows[0]?.cap_window).toBe('24h');
	});

	test('dispatch is idempotent — re-running does not duplicate notifications', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(sql, requestId);
		await dispatchNotifications(sql, requestId);
		await dispatchNotifications(sql, requestId);

		const rows = await notificationRows(contributor.id);
		expect(rows.length).toBe(1);
	});

	test('request author is never notified for their own request', async () => {
		const author = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: author.id, categoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(sql, requestId);
		await dispatchNotifications(sql, requestId);

		const rows = await notificationRows(author.id);
		expect(rows.length).toBe(0);
	});
});

describe('notification routes', () => {
	test('GET /notifications returns 401 for unauthenticated request', async () => {
		const app = mkApp();
		const res = await req(app, '/notifications');
		expect(res.status).toBe(401);
	});

	test('GET /notifications returns notifications for authenticated user', async () => {
		const app = mkApp();
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const token = await loginToken(app, contributor.email);

		const requestId = await createRequestRow(author.id, { categoryId });
		await recomputeMatches(sql, requestId);
		await dispatchNotifications(sql, requestId);

		const res = await req(app, '/notifications', {
			headers: { authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			notifications: { id: string; type: string; title: string; readAt: string | null }[];
			unreadCount: number;
		};
		expect(body.notifications.length).toBe(1);
		expect(body.notifications[0]?.type).toBe('new_match');
		expect(body.notifications[0]?.readAt).toBeNull();
		expect(body.unreadCount).toBe(1);
	});

	test('PATCH /notifications/:id marks notification as read and decrements unread count', async () => {
		const app = mkApp();
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const token = await loginToken(app, contributor.email);

		const requestId = await createRequestRow(author.id, { categoryId });
		await recomputeMatches(sql, requestId);
		await dispatchNotifications(sql, requestId);

		const notifRows = await notificationRows(contributor.id);
		const notifId = notifRows[0]?.id as string;

		const res = await req(app, `/notifications/${notifId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify({ read: true }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { readAt: string | null };
		expect(body.readAt).not.toBeNull();

		const listRes = await req(app, '/notifications', {
			headers: { authorization: `Bearer ${token}` },
		});
		const listBody = (await listRes.json()) as { unreadCount: number };
		expect(listBody.unreadCount).toBe(0);
	});

	test('PATCH /notifications/:id persists after reload', async () => {
		const app = mkApp();
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const token = await loginToken(app, contributor.email);

		const requestId = await createRequestRow(author.id, { categoryId });
		await recomputeMatches(sql, requestId);
		await dispatchNotifications(sql, requestId);

		const notifRows = await notificationRows(contributor.id);
		const notifId = notifRows[0]?.id as string;

		await req(app, `/notifications/${notifId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify({ read: true }),
		});

		const res = await req(app, `/notifications/${notifId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify({ read: false }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { readAt: string | null };
		expect(body.readAt).toBeNull();
	});

	test('user cannot see another user notifications', async () => {
		const app = mkApp();
		const author = await createUser();
		const contributor1 = await createUser();
		const contributor2 = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor1.id, categoryId });
		await addCapability({ userId: contributor2.id, categoryId });
		const token1 = await loginToken(app, contributor1.email);
		const token2 = await loginToken(app, contributor2.email);

		const requestId = await createRequestRow(author.id, { categoryId });
		await recomputeMatches(sql, requestId);
		await dispatchNotifications(sql, requestId);

		const res1 = await req(app, '/notifications', {
			headers: { authorization: `Bearer ${token1}` },
		});
		const body1 = (await res1.json()) as {
			notifications: { userId: string }[];
		};
		expect(body1.notifications.every((n) => n.userId === contributor1.id)).toBe(true);

		const res2 = await req(app, '/notifications', {
			headers: { authorization: `Bearer ${token2}` },
		});
		const body2 = (await res2.json()) as {
			notifications: { userId: string }[];
		};
		expect(body2.notifications.every((n) => n.userId === contributor2.id)).toBe(true);
	});
});

describe('matching queue integration', () => {
	test('publish triggers matching and notification dispatch', async () => {
		const app = mkApp();
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const token = await loginToken(app, author.email);

		const draft = await req(app, '/requests', {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify({
				title: 'Help with soldering',
				goal: 'Learn to solder a simple circuit for a school project',
				barrier: 'No tools and no guidance from anyone nearby',
				helpNeeded: 'Someone patient who can show me the basics',
				categoryId,
			}),
		});
		expect(draft.status).toBe(201);
		const draftBody = (await draft.json()) as { id: string };
		const published = await req(app, `/requests/${draftBody.id}/publish`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}` },
		});
		expect(published.status).toBe(200);

		await waitForMatchRows(draftBody.id);

		const notifRows = await notificationRows(contributor.id);
		expect(notifRows.length).toBe(1);
		expect(notifRows[0]?.type).toBe('new_match');
	});
});

describe('buildNotificationBody', () => {
	test('includes capability match when score >= 0.8', () => {
		const body = buildNotificationBody(
			{
				capability_match: 1,
				modality_fit: 1,
				location_proximity: 0.5,
				availability_preferences: 1,
				reliability: 0.5,
				fatigue_dampening: 1,
				request_quality: 0.8,
			},
			'Help with soldering',
		);
		expect(body.title).toContain('Help with soldering');
		expect(body.body).toContain('capability match');
	});

	test('includes modality fit when score >= 0.8', () => {
		const body = buildNotificationBody(
			{
				capability_match: 0.5,
				modality_fit: 1,
				location_proximity: 0.5,
				availability_preferences: 1,
				reliability: 0.5,
				fatigue_dampening: 1,
				request_quality: 0.8,
			},
			'Help with soldering',
		);
		expect(body.body).toContain('modality fit');
	});

	test('includes location proximity when score >= 0.8', () => {
		const body = buildNotificationBody(
			{
				capability_match: 0.5,
				modality_fit: 0.5,
				location_proximity: 1,
				availability_preferences: 1,
				reliability: 0.5,
				fatigue_dampening: 1,
				request_quality: 0.8,
			},
			'Help with soldering',
		);
		expect(body.body).toContain('location proximity');
	});

	test('includes reliability signal when score >= 0.7', () => {
		const body = buildNotificationBody(
			{
				capability_match: 0.5,
				modality_fit: 0.5,
				location_proximity: 0.5,
				availability_preferences: 1,
				reliability: 0.8,
				fatigue_dampening: 1,
				request_quality: 0.8,
			},
			'Help with soldering',
		);
		expect(body.body).toContain('strong reliability signal');
	});

	test('no special factors when all below thresholds', () => {
		const body = buildNotificationBody(
			{
				capability_match: 0.5,
				modality_fit: 0.5,
				location_proximity: 0.5,
				availability_preferences: 1,
				reliability: 0.5,
				fatigue_dampening: 0.5,
				request_quality: 0.5,
			},
			'Help with soldering',
		);
		expect(body.body).toContain('new match');
		expect(body.body).not.toMatch(/\(/);
	});
});
