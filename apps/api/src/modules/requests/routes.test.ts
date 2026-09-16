import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq, getDatabase, getPool, migrate } from '@together/db';
import { categories, requests, users } from '@together/db/schema';
import { makeApp } from '../../app';

const DB_URL =
	process.env.TEST_DATABASE_URL ?? 'postgresql://together:together@localhost:5433/together_test';

let app: ReturnType<typeof makeApp>;

beforeAll(async () => {
	await migrate(DB_URL);
});

beforeEach(() => {
	app = makeApp({
		databaseUrl: DB_URL,
		db: getDatabase(),
		otpProvider: 'mock',
		isProduction: false,
	});
});

let userSeq = 0;
async function createUser(): Promise<{ id: string; email: string }> {
	userSeq += 1;
	const email = `req-user-${Date.now()}-${userSeq}@example.com`;
	const hash = await Bun.password.hash('password123', { algorithm: 'argon2id' });
	const [row] = await getDatabase()
		.insert(users)
		.values({
			email,
			passwordHash: hash,
			phoneVerified: true,
		})
		.returning();
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
	const slug = `cat-${Date.now()}-${Math.random()}`;
	const [row] = await getDatabase()
		.insert(categories)
		.values({
			name: 'Test Cat',
			slug,
		})
		.returning();
	if (!row) throw new Error('Failed to create category');
	return row.id;
}

describe('GET /requests/:id (Discovery & Social cards access)', () => {
	test('unauthenticated visitor can view a published request', async () => {
		const author = await createUser();
		const catId = await createCategory();
		const [row] = await getDatabase()
			.insert(requests)
			.values({
				authorId: author.id,
				categoryId: catId,
				title: 'Solar Panel Setup',
				goal: 'Install solar for school',
				barrier: 'Need technician',
				helpNeeded: 'Guidance',
				state: 'published',
			})
			.returning();
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
		const [row] = await getDatabase()
			.insert(requests)
			.values({
				authorId: author.id,
				categoryId: catId,
				title: 'Book Donation',
				goal: 'Gather books',
				barrier: 'Transport',
				helpNeeded: 'Van driver',
				state: 'published',
			})
			.returning();
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
		const [row] = await getDatabase()
			.insert(requests)
			.values({
				authorId: author.id,
				categoryId: catId,
				title: 'Laptop Needed',
				goal: 'I need a laptop',
				barrier: 'No funds',
				helpNeeded: 'Used laptop',
				state: 'published',
			})
			.returning();
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
		const [row] = await getDatabase()
			.insert(requests)
			.values({
				authorId: author.id,
				categoryId: catId,
				title: 'Draft Title',
				goal: 'Draft Goal',
				barrier: 'Draft Barrier',
				helpNeeded: 'Draft Help',
				state: 'draft',
			})
			.returning();
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
		const [row] = await getDatabase()
			.insert(requests)
			.values({
				authorId: author.id,
				categoryId: catId,
				title: 'Draft Title',
				goal: 'Draft Goal',
				barrier: 'Draft Barrier',
				helpNeeded: 'Draft Help',
				state: 'draft',
			})
			.returning();
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
		const [row] = await getDatabase()
			.insert(requests)
			.values({
				authorId: author.id,
				categoryId: catId,
				title: 'Draft Title',
				goal: 'Draft Goal',
				barrier: 'Draft Barrier',
				helpNeeded: 'Draft Help',
				state: 'draft',
			})
			.returning();
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
