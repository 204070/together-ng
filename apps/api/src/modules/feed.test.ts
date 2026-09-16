import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { getDatabase, getPool, migrate } from '@together/db';
import { requests, users } from '@together/db/schema';
import { makeApp } from '../app';

const DB_URL =
	process.env.TEST_DATABASE_URL ??
	'postgresql://together:together@localhost:5433/together_wt7_test';

type App = ReturnType<typeof makeApp>;

function mkApp(): App {
	return makeApp({
		databaseUrl: DB_URL,
		db: getDatabase(),
		otpProvider: 'mock',
		isProduction: false,
		jwtSecret: 'test-secret',
	});
}

async function seedRequest(state: 'draft' | 'published', title: string): Promise<string> {
	const db = getDatabase();
	const [user] = await db
		.insert(users)
		.values({
			email: `feed-${title}@example.com`,
			passwordHash: 'x',
		})
		.returning();
	if (!user) throw new Error('Failed to create user');
	const [row] = await db
		.insert(requests)
		.values({
			authorId: user.id,
			title,
			goal: 'goal',
			barrier: 'barrier',
			helpNeeded: 'help',
			state: state as 'draft' | 'published',
		})
		.returning();
	return row!.id;
}

beforeAll(async () => {
	await migrate(DB_URL);
});

describe('GET /requests/featured', () => {
	test('returns { items: [] } on an empty database', async () => {
		const res = await mkApp().handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ items: [] });
	});

	test('published request title and id appear in the response', async () => {
		const id = await seedRequest('published', 'Feed seed title');
		const res = await mkApp().handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: Array<{ id: string; title: string }> };
		expect(body.items.map((item) => item.id)).toContain(id);
		expect(body.items.map((item) => item.title)).toContain('Feed seed title');
	});

	test('draft requests are excluded', async () => {
		await seedRequest('draft', 'Draft stays hidden');
		const res = await mkApp().handle(new Request('http://localhost/requests/featured'));
		expect(await res.json()).toEqual({ items: [] });
	});

	test('literal /requests/featured wins over GET /requests/:id', async () => {
		await seedRequest('published', 'Literal route title');
		const res = await mkApp().handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(Array.isArray(body.items)).toBe(true);
	});
});
