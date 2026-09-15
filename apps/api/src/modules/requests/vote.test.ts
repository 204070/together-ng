import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createClient, migrate, type Sql } from '@together/db';
import { makeApp } from '../../app';

const DB_URL =
	process.env.TEST_DATABASE_URL ??
	'postgresql://together:together@localhost:5433/together_wt11_test';

let sql: Sql;
let app: ReturnType<typeof makeApp>;

beforeAll(async () => {
	sql = createClient(DB_URL);
	await migrate(DB_URL);
	app = makeApp({ databaseUrl: '', sql, otpProvider: 'mock', isProduction: false });
});

afterAll(async () => {
	await sql.end();
});

beforeEach(async () => {
	await sql`TRUNCATE users, categories, requests, votes RESTART IDENTITY CASCADE`;
});

let userSeq = 0;
async function createUser(): Promise<{ id: string; email: string }> {
	userSeq += 1;
	const email = `vote-user-${Date.now()}-${userSeq}@example.com`;
	const hash = await Bun.password.hash('password123', { algorithm: 'argon2id' });
	const [row] = await sql<{ id: string }[]>`
		INSERT INTO users (email, password_hash, phone_verified)
		VALUES (${email}, ${hash}, true)
		RETURNING id
	`;
	if (!row) throw new Error('Failed to create user');
	return { id: row.id, email };
}

async function loginToken(email: string): Promise<string> {
	const res = await app.handle(
		new Request('http://localhost/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email, password: 'password123' }),
		}),
	);
	const body = (await res.json()) as { token: string };
	return body.token;
}

async function createCategory(): Promise<number> {
	const [row] = await sql<{ id: number }[]>`
		INSERT INTO categories (name, slug)
		VALUES ('Test Cat', ${`cat-${Date.now()}-${Math.random()}`})
		RETURNING id
	`;
	if (!row) throw new Error('Failed to create category');
	return row.id;
}

async function createPublishedRequest(authorId: string, catId: number): Promise<string> {
	const [row] = await sql<{ id: string }[]>`
		INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
		VALUES (${authorId}, ${catId}, 'Solar Panel Setup', 'Install solar for school', 'Need technician', 'Guidance', 'published')
		RETURNING id
	`;
	if (!row) throw new Error('Failed to create request');
	return row.id;
}

async function createDraftRequest(authorId: string, catId: number): Promise<string> {
	const [row] = await sql<{ id: string }[]>`
		INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
		VALUES (${authorId}, ${catId}, 'Draft Request', 'Draft goal', 'Draft barrier', 'Draft help', 'draft')
		RETURNING id
	`;
	if (!row) throw new Error('Failed to create request');
	return row.id;
}

async function createClosedRequest(authorId: string, catId: number): Promise<string> {
	const [row] = await sql<{ id: string }[]>`
		INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
		VALUES (${authorId}, ${catId}, 'Closed Request', 'Closed goal', 'Closed barrier', 'Closed help', 'closed')
		RETURNING id
	`;
	if (!row) throw new Error('Failed to create request');
	return row.id;
}

function authHeaders(token: string): Record<string, string> {
	return { authorization: `Bearer ${token}` };
}

describe('POST /requests/:id/vote', () => {
	test('authenticated user can upvote a published request', async () => {
		const voter = await createUser();
		const author = await createUser();
		const token = await loginToken(voter.email);
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { voteCount: number; hasVoted: boolean };
		expect(body.voteCount).toBe(1);
		expect(body.hasVoted).toBe(true);

		// Verify DB row
		const votes =
			await sql`SELECT count(*)::int AS count FROM votes WHERE user_id = ${voter.id} AND request_id = ${requestId}`;
		expect(votes[0]?.count).toBe(1);
	});

	test('duplicate POST returns 409 and voteCount unchanged', async () => {
		const voter = await createUser();
		const author = await createUser();
		const token = await loginToken(voter.email);
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		const first = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);
		expect(first.status).toBe(201);

		const second = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);
		expect(second.status).toBe(409);
		const body = (await second.json()) as { error: string };
		expect(body.error).toBe('ALREADY_VOTED');

		// Only one DB row
		const votes =
			await sql`SELECT count(*)::int AS count FROM votes WHERE user_id = ${voter.id} AND request_id = ${requestId}`;
		expect(votes[0]?.count).toBe(1);
	});

	test('unauthenticated POST returns 401', async () => {
		const author = await createUser();
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
			}),
		);
		expect(res.status).toBe(401);
	});

	test('POST on own request returns 403', async () => {
		const author = await createUser();
		const token = await loginToken(author.email);
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('CANNOT_VOTE_OWN_REQUEST');
	});

	test('POST on non-existent request returns 404', async () => {
		const voter = await createUser();
		const token = await loginToken(voter.email);

		const res = await app.handle(
			new Request('http://localhost/requests/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/vote', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('NOT_FOUND');
	});

	test('POST with malformed UUID returns 400/422', async () => {
		const voter = await createUser();
		const token = await loginToken(voter.email);

		const res = await app.handle(
			new Request('http://localhost/requests/not-a-uuid/vote', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThan(500);
	});

	test('POST on draft request returns 422', async () => {
		const voter = await createUser();
		const author = await createUser();
		const token = await loginToken(voter.email);
		const catId = await createCategory();
		const requestId = await createDraftRequest(author.id, catId);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('VOTING_NOT_ALLOWED');
	});

	test('POST on closed request returns 422', async () => {
		const voter = await createUser();
		const author = await createUser();
		const token = await loginToken(voter.email);
		const catId = await createCategory();
		const requestId = await createClosedRequest(author.id, catId);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);
		expect(res.status).toBe(422);
	});

	test('deleted/suspended user voting returns 401', async () => {
		const voter = await createUser();
		const author = await createUser();
		const token = await loginToken(voter.email);
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		// Suspend the user
		await sql`UPDATE users SET status = 'suspended' WHERE id = ${voter.id}`;

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);
		expect(res.status).toBe(401);
	});
});

describe('DELETE /requests/:id/vote', () => {
	test('authenticated user can remove their vote', async () => {
		const voter = await createUser();
		const author = await createUser();
		const token = await loginToken(voter.email);
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		// First vote
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);

		// Remove vote
		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'DELETE',
				headers: authHeaders(token),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { voteCount: number; hasVoted: boolean };
		expect(body.voteCount).toBe(0);
		expect(body.hasVoted).toBe(false);

		// Verify DB row removed
		const votes =
			await sql`SELECT count(*)::int AS count FROM votes WHERE user_id = ${voter.id} AND request_id = ${requestId}`;
		expect(votes[0]?.count).toBe(0);
	});

	test('DELETE when no vote exists returns 404', async () => {
		const voter = await createUser();
		const author = await createUser();
		const token = await loginToken(voter.email);
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'DELETE',
				headers: authHeaders(token),
			}),
		);
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('VOTE_NOT_FOUND');
	});

	test('unauthenticated DELETE returns 401', async () => {
		const author = await createUser();
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'DELETE',
			}),
		);
		expect(res.status).toBe(401);
	});

	test('vote count is accurate after multiple users vote', async () => {
		const author = await createUser();
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		const voters = await Promise.all([createUser(), createUser(), createUser()]);

		for (const voter of voters) {
			const token = await loginToken(voter.email);
			await app.handle(
				new Request(`http://localhost/requests/${requestId}/vote`, {
					method: 'POST',
					headers: { 'content-type': 'application/json', ...authHeaders(token) },
				}),
			);
		}

		const res = await app.handle(new Request(`http://localhost/requests/${requestId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { voteCount: number };
		expect(body.voteCount).toBe(3);
	});

	test('vote and unvote cycle returns to original state', async () => {
		const voter = await createUser();
		const author = await createUser();
		const token = await loginToken(voter.email);
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		// Vote
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);

		// Unvote
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'DELETE',
				headers: authHeaders(token),
			}),
		);

		// Can vote again
		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
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
		const voter = await createUser();
		const author = await createUser();
		const token = await loginToken(voter.email);
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		// Vote first
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers: authHeaders(token),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { voteCount: number; hasVoted: boolean };
		expect(body.voteCount).toBe(1);
		expect(body.hasVoted).toBe(true);
	});

	test('returns voteCount:0 and hasVoted:false for unauthenticated user', async () => {
		const voter = await createUser();
		const author = await createUser();
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		// Another user votes
		const token = await loginToken(voter.email);
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
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
		const author = await createUser();
		const voter = await createUser();
		const catId = await createCategory();
		const requestId = await createPublishedRequest(author.id, catId);

		const token = await loginToken(voter.email);
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authHeaders(token) },
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
		const voter = await createUser();
		const author = await createUser();
		const catId = await createCategory();
		const [reqRow] = await sql<{ id: string }[]>`
			INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
			VALUES (${author.id}, ${catId}, 'Test', 'Goal', 'Barrier', 'Help', 'published')
			RETURNING id
		`;
		if (!reqRow) throw new Error('Failed to create request');

		await sql`INSERT INTO votes (user_id, request_id) VALUES (${voter.id}, ${reqRow.id})`;

		let threw = false;
		try {
			await sql`INSERT INTO votes (user_id, request_id) VALUES (${voter.id}, ${reqRow.id})`;
		} catch {
			threw = true;
		}
		expect(threw).toBe(true);

		const count =
			await sql`SELECT count(*)::int AS count FROM votes WHERE user_id = ${voter.id} AND request_id = ${reqRow.id}`;
		expect(count[0]?.count).toBe(1);
	});
});
