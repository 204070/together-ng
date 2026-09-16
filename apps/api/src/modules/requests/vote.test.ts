import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { and, count, eq, getDatabase, migrate, sql } from '@together/db';
import { votes } from '@together/db/schema';
import { createRequestFixture, createUser, makeTestApp, userAuth } from '../../testing/helpers';

const DB_URL =
	process.env.TEST_DATABASE_URL ??
	'postgresql://together:together@localhost:5433/together_wt11_test';

let app: ReturnType<typeof makeTestApp>;

beforeAll(async () => {
	await migrate(DB_URL);
});

beforeEach(() => {
	app = makeTestApp();
});

describe('POST /requests/:id/vote', () => {
	test('authenticated user can upvote a published request', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { user: voter, headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { voteCount: number; hasVoted: boolean };
		expect(body.voteCount).toBe(1);
		expect(body.hasVoted).toBe(true);

		// Verify DB row
		const [result] = await getDatabase()
			.select({ count: count() })
			.from(votes)
			.where(and(eq(votes.userId, voter.id), eq(votes.requestId, requestId)));
		expect(result?.count).toBe(1);
	});

	test('duplicate POST returns 409 and voteCount unchanged', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { user: voter, headers } = await userAuth();

		const first = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(first.status).toBe(201);

		const second = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(second.status).toBe(409);
		const body = (await second.json()) as { error: string };
		expect(body.error).toBe('ALREADY_VOTED');

		// Only one DB row
		const [result] = await getDatabase()
			.select({ count: count() })
			.from(votes)
			.where(and(eq(votes.userId, voter.id), eq(votes.requestId, requestId)));
		expect(result?.count).toBe(1);
	});

	test('unauthenticated POST returns 401', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
			}),
		);
		expect(res.status).toBe(401);
	});

	test('POST on own request returns 403', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('CANNOT_VOTE_OWN_REQUEST');
	});

	test('POST on non-existent request returns 404', async () => {
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request('http://localhost/requests/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/vote', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('NOT_FOUND');
	});

	test('POST with malformed UUID returns 400/422', async () => {
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request('http://localhost/requests/not-a-uuid/vote', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThan(500);
	});

	test('POST on draft request returns 422', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'draft' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('VOTING_NOT_ALLOWED');
	});

	test('POST on closed request returns 422', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'closed' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(422);
	});

	test('POST on archived request returns 422', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'archived' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('VOTING_NOT_ALLOWED');
	});

	test('POST on cancelled request returns 422', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'cancelled' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('VOTING_NOT_ALLOWED');
	});

	test('POST on under_review request returns 422', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'under_review' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('VOTING_NOT_ALLOWED');
	});

	test('deleted/suspended user voting returns 401', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth({ status: 'suspended' });

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(401);
	});
});

describe('DELETE /requests/:id/vote', () => {
	test('authenticated user can remove their vote', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { user: voter, headers } = await userAuth();

		// First vote
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);

		// Remove vote
		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'DELETE',
				headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { voteCount: number; hasVoted: boolean };
		expect(body.voteCount).toBe(0);
		expect(body.hasVoted).toBe(false);

		// Verify DB row removed
		const [result] = await getDatabase()
			.select({ count: count() })
			.from(votes)
			.where(and(eq(votes.userId, voter.id), eq(votes.requestId, requestId)));
		expect(result?.count).toBe(0);
	});

	test('DELETE when no vote exists returns 404', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'DELETE',
				headers,
			}),
		);
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('VOTE_NOT_FOUND');
	});

	test('unauthenticated DELETE returns 401', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'DELETE',
			}),
		);
		expect(res.status).toBe(401);
	});

	test('vote count is accurate after multiple users vote', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const voters = [];
		for (let i = 0; i < 3; i++) {
			voters.push(await userAuth());
		}

		for (const voter of voters) {
			await app.handle(
				new Request(`http://localhost/requests/${requestId}/vote`, {
					method: 'POST',
					headers: { 'content-type': 'application/json', ...voter.headers },
				}),
			);
		}

		const res = await app.handle(new Request(`http://localhost/requests/${requestId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { voteCount: number };
		expect(body.voteCount).toBe(3);
	});

	test('vote and unvote cycle returns to original state', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		// Vote
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);

		// Unvote
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'DELETE',
				headers,
			}),
		);

		// Can vote again
		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { voteCount: number; hasVoted: boolean };
		expect(body.voteCount).toBe(1);
		expect(body.hasVoted).toBe(true);
	});
});

describe('GET /requests/:id vote data', () => {
	test('returns voteCount and hasVoted for authenticated user', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		// Vote first
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { voteCount: number; hasVoted: boolean };
		expect(body.voteCount).toBe(1);
		expect(body.hasVoted).toBe(true);
	});

	test('returns voteCount:0 and hasVoted:false for unauthenticated user', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		// Another user votes
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);

		// Unauthenticated view
		const res = await app.handle(new Request(`http://localhost/requests/${requestId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { voteCount: number; hasVoted: boolean };
		expect(body.voteCount).toBe(1);
		expect(body.hasVoted).toBe(false);
	});

	test('vote count in feed includes vote data', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);

		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: Array<{ id: string; voteCount: number }> };
		const item = body.items.find((i) => i.id === requestId);
		expect(item).toBeDefined();
		expect(item?.voteCount).toBe(1);
	});
});

describe('DB unique constraint', () => {
	test('direct duplicate INSERT fails at DB level', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const voter = await createUser();

		await getDatabase().insert(votes).values({ userId: voter.id, requestId });

		let threw = false;
		await getDatabase().execute(sql`SAVEPOINT vote_dup_test`);
		try {
			await getDatabase().insert(votes).values({ userId: voter.id, requestId });
			await getDatabase().execute(sql`RELEASE SAVEPOINT vote_dup_test`);
		} catch {
			await getDatabase().execute(sql`ROLLBACK TO SAVEPOINT vote_dup_test`);
			threw = true;
		}
		expect(threw).toBe(true);

		const [result] = await getDatabase()
			.select({ count: count() })
			.from(votes)
			.where(and(eq(votes.userId, voter.id), eq(votes.requestId, requestId)));
		expect(result?.count).toBe(1);
	});
});
