import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createClient, migrate, type Sql } from '@together/db';
import { makeApp } from '../../app';

const DB_URL =
	process.env.TEST_DATABASE_URL ?? 'postgresql://together:together@localhost:5433/together_test';

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
	await sql`TRUNCATE users, categories, requests RESTART IDENTITY CASCADE`;
});

let userSeq = 0;
async function createUser(): Promise<{ id: string; email: string }> {
	userSeq += 1;
	const email = `req-user-${Date.now()}-${userSeq}@example.com`;
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

describe('GET /requests/:id (Discovery & Social cards access)', () => {
	test('unauthenticated visitor can view a published request', async () => {
		const author = await createUser();
		const catId = await createCategory();
		const [row] = await sql<{ id: string }[]>`
			INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
			VALUES (${author.id}, ${catId}, 'Solar Panel Setup', 'Install solar for school', 'Need technician', 'Guidance', 'published')
			RETURNING id
		`;
		if (!row) throw new Error('Failed to create request');
		const requestId = row.id;

		const res = await app.handle(new Request(`http://localhost/requests/${requestId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBe(requestId);
		expect(body.title).toBe('Solar Panel Setup');
		expect(body.state).toBe('published');
		// Unauthenticated viewer does not receive draft quality hints
		expect(body.qualityHints).toBeUndefined();
	});

	test('another authenticated user can view a published request', async () => {
		const author = await createUser();
		const reader = await createUser();
		const token = await loginToken(reader.email);
		const catId = await createCategory();
		const [row] = await sql<{ id: string }[]>`
			INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
			VALUES (${author.id}, ${catId}, 'Book Donation', 'Gather books', 'Transport', 'Van driver', 'published')
			RETURNING id
		`;
		if (!row) throw new Error('Failed to create request');
		const requestId = row.id;

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers: { authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBe(requestId);
		expect(body.qualityHints).toBeUndefined();
	});

	test('author viewing their own request receives quality hints', async () => {
		const author = await createUser();
		const token = await loginToken(author.email);
		const catId = await createCategory();
		const [row] = await sql<{ id: string }[]>`
			INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
			VALUES (${author.id}, ${catId}, 'Laptop Needed', 'I need a laptop', 'No funds', 'Used laptop', 'published')
			RETURNING id
		`;
		if (!row) throw new Error('Failed to create request');
		const requestId = row.id;

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers: { authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBe(requestId);
		expect(Array.isArray(body.qualityHints)).toBe(true);
	});

	test('unauthenticated visitor receives 404 for a draft request', async () => {
		const author = await createUser();
		const catId = await createCategory();
		const [row] = await sql<{ id: string }[]>`
			INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
			VALUES (${author.id}, ${catId}, 'Draft Title', 'Draft Goal', 'Draft Barrier', 'Draft Help', 'draft')
			RETURNING id
		`;
		if (!row) throw new Error('Failed to create request');
		const requestId = row.id;

		const res = await app.handle(new Request(`http://localhost/requests/${requestId}`));
		expect(res.status).toBe(404);
	});

	test('different authenticated user receives 404 for a draft request', async () => {
		const author = await createUser();
		const other = await createUser();
		const token = await loginToken(other.email);
		const catId = await createCategory();
		const [row] = await sql<{ id: string }[]>`
			INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
			VALUES (${author.id}, ${catId}, 'Draft Title', 'Draft Goal', 'Draft Barrier', 'Draft Help', 'draft')
			RETURNING id
		`;
		if (!row) throw new Error('Failed to create request');
		const requestId = row.id;

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers: { authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(404);
	});

	test('author can view their own draft request with quality hints', async () => {
		const author = await createUser();
		const token = await loginToken(author.email);
		const catId = await createCategory();
		const [row] = await sql<{ id: string }[]>`
			INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state)
			VALUES (${author.id}, ${catId}, 'Draft Title', 'Draft Goal', 'Draft Barrier', 'Draft Help', 'draft')
			RETURNING id
		`;
		if (!row) throw new Error('Failed to create request');
		const requestId = row.id;

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers: { authorization: `Bearer ${token}` },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBe(requestId);
		expect(body.state).toBe('draft');
		expect(Array.isArray(body.qualityHints)).toBe(true);
	});
});
