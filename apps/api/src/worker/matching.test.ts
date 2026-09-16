import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Db, and, asc, desc, eq, getDatabase, getPool, migrate, sql, users, categories, skills, contributorCapabilities, notificationPreferences, requests, requestMatches, contributions, outcomeConfirmations } from '@together/db';
import { makeApp } from '../app';
import { createMatchingQueue, MATCHING_QUEUE } from '../queue';
import {
	createInlineMatchingService,
	createInternalMatchingRouter,
	recomputeMatches,
} from './matching';

const DB_URL =
	process.env.TEST_DATABASE_URL ??
	'postgresql://together:together@localhost:5433/together_wt12_test';
const JWT_SECRET = 'test-secret';

let db: Db;
let queue: ReturnType<typeof createMatchingQueue>;

type App = ReturnType<typeof makeApp>;

function mkApp(): App {
	return makeApp({
		databaseUrl: DB_URL,
		db: getDatabase(),
		otpProvider: 'mock',
		isProduction: false,
		jwtSecret: JWT_SECRET,
		matching: queue.asService(),
	});
}

function req(app: App, path: string, init: RequestInit = {}): Promise<Response> {
	return app.handle(new Request(`http://localhost:4012${path}`, init));
}

let seq = 0;
function unique(prefix: string): string {
	seq += 1;
	return `${prefix}-${Date.now()}-${seq}`;
}

async function createUser(email?: string, isAdmin = false): Promise<{ id: string; email: string }> {
	const address = email ?? `${unique('m')}@example.com`;
	const hash = await Bun.password.hash('password123', { algorithm: 'argon2id' });
	const [row] = await getDatabase().insert(users).values({
		email: address,
		passwordHash: hash,
		phoneVerified: true,
		isAdmin,
	}).returning();
	return { id: row!.id, email: address };
}

async function waitForMatchRows(requestId: string, timeoutMs = 5000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const rows = await matchRows(requestId);
		if (rows.length > 0) return rows;
		await new Promise((r) => setTimeout(r, 50));
	}
	return matchRows(requestId);
}

async function waitForCompletedJob(queueName: string, timeoutMs = 5000): Promise<number> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const { rows } = await getPool().query<{ count: number }>(
			"SELECT count(*)::int AS count FROM pgboss.job WHERE name = $1 AND state = 'completed'",
			[queueName],
		);
		const count = rows[0]?.count ?? 0;
		if (count > 0) return count;
		await new Promise((r) => setTimeout(r, 50));
	}
	return 0;
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
	const [row] = await getDatabase().insert(categories).values({ name: s, slug: s }).returning();
	return row!.id;
}

async function createSkill(categoryId: number, slug?: string): Promise<number> {
	const s = slug ?? unique('skill');
	const [row] = await getDatabase().insert(skills).values({ categoryId, name: s, slug: s }).returning();
	return row!.id;
}

async function addCapability(input: {
	userId: string;
	categoryId?: number | null;
	skillId?: number | null;
	modality?: string;
	location?: string | null;
}): Promise<void> {
	await getDatabase().insert(contributorCapabilities).values({
		userId: input.userId,
		categoryId: input.categoryId ?? null,
		skillId: input.skillId ?? null,
		modality: (input.modality as 'online' | 'in_person' | 'both') ?? 'both',
		location: input.location ?? null,
	});
}

async function setPrefs(userId: string, patch: Record<string, boolean>): Promise<void> {
	const defaults = {
		notify_new_matches: true,
		notify_remote: true,
		notify_local: true,
		notify_resource_lending: true,
		notify_mentorship: true,
		...patch,
	};
	await getDatabase().insert(notificationPreferences).values({
		userId,
		notifyNewMatches: defaults.notify_new_matches,
		notifyRemote: defaults.notify_remote,
		notifyLocal: defaults.notify_local,
		notifyResourceLending: defaults.notify_resource_lending,
		notifyMentorship: defaults.notify_mentorship,
	}).onConflictDoUpdate({
		target: [notificationPreferences.userId],
		set: {
			notifyNewMatches: defaults.notify_new_matches,
			notifyRemote: defaults.notify_remote,
			notifyLocal: defaults.notify_local,
			notifyResourceLending: defaults.notify_resource_lending,
			notifyMentorship: defaults.notify_mentorship,
		},
	});
}

async function createRequestRow(
	authorId: string,
	fields: {
		categoryId: number | null;
		modality?: string | null;
		helpType?: string | null;
		location?: string | null;
	},
): Promise<string> {
	const [row] = await getDatabase().insert(requests).values({
		authorId,
		categoryId: fields.categoryId,
		title: 'Help with soldering',
		goal: 'Learn to solder a simple circuit for a school project',
		barrier: 'No tools and no guidance from anyone nearby',
		helpNeeded: 'Someone patient who can show me the basics',
		state: 'published',
		modality: (fields.modality as 'online' | 'in_person' | 'both') ?? 'both',
		helpType: (fields.helpType as 'borrow' | 'learn' | null) ?? null,
		location: fields.location ?? null,
	}).returning();
	return row!.id;
}

async function addCompletedContribution(
	contributorId: string,
	requestId: string,
	helpful: boolean | null,
	recipientId: string,
): Promise<void> {
	const db = getDatabase();
	const [row] = await db.insert(contributions).values({
		requestId,
		contributorId,
		status: 'completed',
		completedAt: new Date(),
	}).returning();
	if (helpful !== null && row) {
		await db.insert(outcomeConfirmations).values({
			contributionId: row.id,
			recipientId,
			response: helpful ? 'yes_significantly' : 'no',
		});
	}
}

async function publishViaHttp(
	app: App,
	token: string,
	categoryId: number,
	extra: Record<string, unknown> = {},
): Promise<string> {
	const draft = await req(app, '/requests', {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
		body: JSON.stringify({
			title: 'Help with soldering',
			goal: 'Learn to solder a simple circuit for a school project',
			barrier: 'No tools and no guidance from anyone nearby',
			helpNeeded: 'Someone patient who can show me the basics',
			categoryId,
			...extra,
		}),
	});
	expect(draft.status).toBe(201);
	const draftBody = (await draft.json()) as { id: string };
	const published = await req(app, `/requests/${draftBody.id}/publish`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` },
	});
	expect(published.status).toBe(200);
	return draftBody.id;
}

async function matchRows(requestId: string) {
	return getDatabase().select({
		contributor_id: requestMatches.contributorId,
		score: sql<string>`score::text`,
		reasons: requestMatches.reasons,
	}).from(requestMatches)
	.where(eq(requestMatches.requestId, requestId))
	.orderBy(desc(requestMatches.score), asc(requestMatches.contributorId));
}

beforeAll(async () => {
	db = getDatabase();
	await migrate(DB_URL);
	queue = createMatchingQueue({ connectionString: DB_URL, db });
	await queue.start();
});

afterAll(async () => {
	await queue.stop();
	await getPool().end();
});

beforeEach(async () => {
	await getPool().query('TRUNCATE users, categories, skills RESTART IDENTITY CASCADE');
});

describe('matching queue (Postgres-backed)', () => {
	test('publish enqueues a job that completes and writes request_matches', async () => {
		const app = mkApp();
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const token = await loginToken(app, author.email);

		const requestId = await publishViaHttp(app, token, categoryId);
		const rows = await waitForMatchRows(requestId);
		expect(rows.length).toBe(1);
		expect(rows[0]?.contributor_id).toBe(contributor.id);

		const completedCount = await waitForCompletedJob(MATCHING_QUEUE);
		expect(completedCount).toBeGreaterThan(0);
	});

	test('internal matches endpoint requires admin authentication and exposes breakdown', async () => {
		const app = mkApp();
		const author = await createUser();
		const contributor = await createUser();
		const admin = await createUser(undefined, true);
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const token = await loginToken(app, author.email);
		const adminToken = await loginToken(app, admin.email);

		const requestId = await publishViaHttp(app, token, categoryId);
		await waitForMatchRows(requestId);

		// Unauthenticated returns 401
		const unauth = await req(app, `/internal/requests/${requestId}/matches`);
		expect(unauth.status).toBe(401);

		// Non-admin returns 403
		const nonAdmin = await req(app, `/internal/requests/${requestId}/matches`, {
			headers: { authorization: `Bearer ${token}` },
		});
		expect(nonAdmin.status).toBe(403);

		// Admin returns 200 with breakdown
		const res = await req(app, `/internal/requests/${requestId}/matches`, {
			headers: { authorization: `Bearer ${adminToken}` },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			requestId: string;
			matches: {
				contributorId: string;
				totalScore: number;
				rank: number;
				factorBreakdown: Record<string, number>;
			}[];
		};
		expect(body.requestId).toBe(requestId);
		expect(body.matches.length).toBe(1);
		expect(body.matches[0]?.contributorId).toBe(contributor.id);
		expect(body.matches[0]?.rank).toBe(1);
		expect(Object.keys(body.matches[0]?.factorBreakdown ?? {}).sort()).toEqual(
			[
				'availability_preferences',
				'capability_match',
				'fatigue_dampening',
				'location_proximity',
				'modality_fit',
				'reliability',
				'request_quality',
			].sort(),
		);

		// createInternalMatchingRouter throws if auth enabled without jwtSecret
		expect(() =>
			createInternalMatchingRouter(db, {
				findUserById: async () => undefined,
			} as never),
		).toThrow('jwtSecret is required when auth is enabled');
	});

	test('internal matches endpoint returns 404 for unknown requests with admin token', async () => {
		const app = mkApp();
		const admin = await createUser(undefined, true);
		const adminToken = await loginToken(app, admin.email);
		const res = await req(app, '/internal/requests/550e8400-e29b-41d4-a716-446655440000/matches', {
			headers: { authorization: `Bearer ${adminToken}` },
		});
		expect(res.status).toBe(404);
	});
});

describe('candidate set', () => {
	test('is exactly the users intersecting the request category or its skills', async () => {
		const author = await createUser();
		const insider = await createUser();
		const skilled = await createUser();
		const outsider = await createUser();
		const categoryId = await createCategory();
		const otherCategoryId = await createCategory();
		const skillId = await createSkill(categoryId);
		await createSkill(otherCategoryId);
		await addCapability({ userId: insider.id, categoryId });
		await addCapability({ userId: skilled.id, skillId });
		await addCapability({ userId: outsider.id, categoryId: otherCategoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(db, requestId);

		const { rows: expected } = await getPool().query<{ user_id: string }>(
			'SELECT DISTINCT cc.user_id FROM contributor_capabilities cc WHERE cc.category_id = $1 OR cc.skill_id = $2',
			[categoryId, skillId],
		);
		const rows = await matchRows(requestId);
		expect(new Set(rows.map((row) => row.contributor_id))).toEqual(
			new Set(expected.map((row) => row.user_id)),
		);
	});

	test('request author is never a candidate for their own request', async () => {
		const author = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: author.id, categoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(db, requestId);

		expect([...(await matchRows(requestId))]).toEqual([]);
	});
});

describe('factor breakdown storage', () => {
	test('each row stores total_score, rank and all seven sub-scores', async () => {
		const author = await createUser();
		const first = await createUser();
		const second = await createUser();
		const categoryId = await createCategory();
		const skillId = await createSkill(categoryId);
		await addCapability({ userId: first.id, skillId });
		await addCapability({ userId: second.id, categoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		const ranked = await recomputeMatches(db, requestId);

		expect(ranked.length).toBe(2);
		expect(ranked[0]?.rank).toBe(1);
		expect(ranked[1]?.rank).toBe(2);
		expect(ranked[0]?.totalScore).toBeGreaterThan(ranked[1]?.totalScore as number);
		const rows = await matchRows(requestId);
		for (const row of rows) {
			const reasons = row.reasons as {
				total_score: number;
				rank: number;
				factor_breakdown: Record<string, number>;
			};
			expect(reasons.total_score).toBe(Number(row.score));
			expect(typeof reasons.rank).toBe('number');
			expect(Object.keys(reasons.factor_breakdown).sort()).toEqual(
				[
					'availability_preferences',
					'capability_match',
					'fatigue_dampening',
					'location_proximity',
					'modality_fit',
					'reliability',
					'request_quality',
				].sort(),
			);
		}
	});
});

describe('capability weight', () => {
	test('exact skill overlap scores strictly higher than category-only overlap', async () => {
		const author = await createUser();
		const skillContributor = await createUser();
		const categoryContributor = await createUser();
		const categoryId = await createCategory();
		const skillId = await createSkill(categoryId);
		await addCapability({ userId: skillContributor.id, categoryId, skillId });
		await addCapability({ userId: categoryContributor.id, categoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		const ranked = await recomputeMatches(db, requestId);

		const byId = new Map(ranked.map((row) => [row.contributorId, row]));
		expect(byId.get(skillContributor.id)?.factorBreakdown.capability_match).toBe(1);
		expect(byId.get(categoryContributor.id)?.factorBreakdown.capability_match).toBeLessThan(1);
		expect(byId.get(skillContributor.id)?.totalScore).toBeGreaterThan(
			byId.get(categoryContributor.id)?.totalScore as number,
		);
	});
});

describe('modality fit', () => {
	test('remote-only request ranks in-person-only contributor below remote/either', async () => {
		const author = await createUser();
		const remote = await createUser();
		const either = await createUser();
		const inPerson = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: remote.id, categoryId, modality: 'online' });
		await addCapability({ userId: either.id, categoryId, modality: 'both' });
		await addCapability({ userId: inPerson.id, categoryId, modality: 'in_person' });
		const requestId = await createRequestRow(author.id, { categoryId, modality: 'online' });

		const ranked = await recomputeMatches(db, requestId);

		const byId = new Map(ranked.map((row) => [row.contributorId, row]));
		expect(byId.get(remote.id)?.factorBreakdown.modality_fit).toBe(1);
		expect(byId.get(either.id)?.factorBreakdown.modality_fit).toBe(1);
		expect(byId.get(inPerson.id)?.factorBreakdown.modality_fit).toBeLessThan(1);
		expect(byId.get(remote.id)?.totalScore).toBeGreaterThan(
			byId.get(inPerson.id)?.totalScore as number,
		);
		expect(byId.get(either.id)?.totalScore).toBeGreaterThan(
			byId.get(inPerson.id)?.totalScore as number,
		);
	});
});

describe('location proximity', () => {
	test('remote requests give every candidate the neutral proximity sub-score', async () => {
		const author = await createUser();
		const near = await createUser();
		const far = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: near.id, categoryId, location: 'Lagos' });
		await addCapability({ userId: far.id, categoryId, location: 'Abuja' });
		const requestId = await createRequestRow(author.id, { categoryId, modality: 'online' });

		const ranked = await recomputeMatches(db, requestId);

		expect(ranked.length).toBe(2);
		for (const row of ranked) {
			expect(row.factorBreakdown.location_proximity).toBe(0.5);
		}
	});

	test('location-requiring requests differentiate on proximity', async () => {
		const author = await createUser();
		const exact = await createUser();
		const other = await createUser();
		const unknown = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: exact.id, categoryId, location: 'Lagos' });
		await addCapability({ userId: other.id, categoryId, location: 'Abuja' });
		await addCapability({ userId: unknown.id, categoryId });
		const requestId = await createRequestRow(author.id, {
			categoryId,
			modality: 'in_person',
			location: 'Lagos',
		});

		const ranked = await recomputeMatches(db, requestId);

		const byId = new Map(ranked.map((row) => [row.contributorId, row]));
		expect(byId.get(exact.id)?.factorBreakdown.location_proximity).toBe(1);
		expect(byId.get(other.id)?.factorBreakdown.location_proximity).toBeLessThan(
			byId.get(unknown.id)?.factorBreakdown.location_proximity as number,
		);
	});
});

describe('availability and notification preferences gate', () => {
	test('opted-out contributors are excluded despite overlap', async () => {
		const author = await createUser();
		const optedOut = await createUser();
		const optedIn = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: optedOut.id, categoryId });
		await addCapability({ userId: optedIn.id, categoryId });
		await setPrefs(optedOut.id, { notify_new_matches: false });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(db, requestId);

		const rows = await matchRows(requestId);
		expect(rows.map((row) => row.contributor_id)).toEqual([optedIn.id]);
	});

	test('remote opt-out excludes from remote requests only', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		await setPrefs(contributor.id, { notify_remote: false });

		const remoteId = await createRequestRow(author.id, { categoryId, modality: 'online' });
		await recomputeMatches(db, remoteId);
		expect([...(await matchRows(remoteId))]).toEqual([]);

		const localId = await createRequestRow(author.id, {
			categoryId,
			modality: 'in_person',
			location: 'Lagos',
		});
		await recomputeMatches(db, localId);
		expect((await matchRows(localId)).map((row) => row.contributor_id)).toEqual([contributor.id]);
	});

	test('local opt-out excludes from location-requiring requests', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		await setPrefs(contributor.id, { notify_local: false });
		const requestId = await createRequestRow(author.id, {
			categoryId,
			modality: 'in_person',
			location: 'Lagos',
		});

		await recomputeMatches(db, requestId);

		expect([...(await matchRows(requestId))]).toEqual([]);
	});
});

describe('reliability', () => {
	test('contributor with completed contributions outranks zero-history', async () => {
		const author = await createUser();
		const veteran = await createUser();
		const newcomer = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: veteran.id, categoryId });
		await addCapability({ userId: newcomer.id, categoryId });
		const historyRequestId = await createRequestRow(author.id, { categoryId });
		for (let i = 0; i < 10; i += 1) {
			await addCompletedContribution(veteran.id, historyRequestId, true, author.id);
		}
		const requestId = await createRequestRow(author.id, { categoryId });

		const ranked = await recomputeMatches(db, requestId);

		const byId = new Map(ranked.map((row) => [row.contributorId, row]));
		expect(byId.get(veteran.id)?.factorBreakdown.reliability).toBeGreaterThan(
			byId.get(newcomer.id)?.factorBreakdown.reliability as number,
		);
		expect(byId.get(veteran.id)?.totalScore).toBeGreaterThan(
			byId.get(newcomer.id)?.totalScore as number,
		);
	});
});

describe('fatigue dampening', () => {
	test('rank drops after repeated matches in 24h', async () => {
		const author = await createUser();
		const regular = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: regular.id, categoryId });

		const firstScores: number[] = [];
		let lastId = '';
		for (let i = 0; i < 4; i += 1) {
			const requestId = await createRequestRow(author.id, { categoryId });
			const ranked = await recomputeMatches(db, requestId);
			firstScores.push(ranked[0]?.totalScore as number);
			lastId = requestId;
		}
		expect(lastId).not.toBe('');

		const fresh = await createUser();
		await addCapability({ userId: fresh.id, categoryId });
		const finalId = await createRequestRow(author.id, { categoryId });
		const ranked = await recomputeMatches(db, finalId);

		const byId = new Map(ranked.map((row) => [row.contributorId, row]));
		expect(byId.get(regular.id)?.factorBreakdown.fatigue_dampening).toBeLessThan(1);
		expect(byId.get(fresh.id)?.factorBreakdown.fatigue_dampening).toBe(1);
		expect(byId.get(fresh.id)?.rank).toBe(1);
		expect(byId.get(regular.id)?.rank).toBe(2);
		expect(byId.get(regular.id)?.totalScore).toBeLessThan(firstScores[0] as number);
	});
});

describe('determinism and edge cases', () => {
	test('re-running the worker produces identical scores and ranking', async () => {
		const author = await createUser();
		const first = await createUser();
		const second = await createUser();
		const categoryId = await createCategory();
		const skillId = await createSkill(categoryId);
		await addCapability({ userId: first.id, skillId });
		await addCapability({ userId: second.id, categoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		const firstRun = await recomputeMatches(db, requestId);
		const secondRun = await recomputeMatches(db, requestId);

		expect(secondRun).toEqual(firstRun);
		const rows = await matchRows(requestId);
		expect(rows.length).toBe(2);
	});

	test('niche category with no contributors publishes cleanly with zero rows', async () => {
		const app = mkApp();
		const author = await createUser();
		const categoryId = await createCategory();
		const token = await loginToken(app, author.email);

		const requestId = await publishViaHttp(app, token, categoryId);

		const admin = await createUser(undefined, true);
		const adminToken = await loginToken(app, admin.email);
		expect([...(await matchRows(requestId))]).toEqual([]);
		const res = await req(app, `/internal/requests/${requestId}/matches`, {
			headers: { authorization: `Bearer ${adminToken}` },
		});
		expect(res.status).toBe(200);
		expect(((await res.json()) as { matches: unknown[] }).matches).toEqual([]);
	});

	test('recomputing matching preserves existing notified_at timestamps', async () => {
		const author = await createUser();
		const contributor = await createUser();
		const categoryId = await createCategory();
		await addCapability({ userId: contributor.id, categoryId });
		const requestId = await createRequestRow(author.id, { categoryId });

		await recomputeMatches(db, requestId);
		// Simulate contributor being notified
		const notifiedDate = new Date('2026-09-15T12:00:00Z');
		await getDatabase().update(requestMatches).set({ notifiedAt: notifiedDate }).where(
			and(eq(requestMatches.requestId, requestId), eq(requestMatches.contributorId, contributor.id)),
		);

		// Recompute matches again
		await recomputeMatches(db, requestId);

		const rows = await matchRows(requestId);
		expect(rows.length).toBe(1);
		const [notified] = await getDatabase().select({ notifiedAt: requestMatches.notifiedAt })
			.from(requestMatches)
			.where(and(eq(requestMatches.requestId, requestId), eq(requestMatches.contributorId, contributor.id)));
		expect(notified?.notifiedAt).toEqual(notifiedDate);
	});

	test('draft edits do not recompute matching', async () => {
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

		const patch = await req(app, `/requests/${draftBody.id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify({ title: 'Help with soldering updated' }),
		});
		expect(patch.status).toBe(200);
		expect([...(await matchRows(draftBody.id))]).toEqual([]);
	});

	test('worker is deterministic and makes no LLM calls', async () => {
		const matchingSource = readFileSync(resolve(import.meta.dir, 'matching.ts'), 'utf8');
		const queueSource = readFileSync(resolve(import.meta.dir, '..', 'queue', 'index.ts'), 'utf8');
		for (const source of [matchingSource, queueSource]) {
			expect(source).not.toMatch(/claude/i);
			expect(source).not.toMatch(/openai/i);
		}
		const inline = createInlineMatchingService(db);
		expect(typeof inline.recompute).toBe('function');
	});
});
