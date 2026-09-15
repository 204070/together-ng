import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createClient, type Sql } from '@together/db';
import { makeApp } from '../app';

const DB_URL =
	process.env.TEST_DATABASE_URL ??
	'postgresql://together:together@localhost:5433/together_wt7_test';

let sql: Sql;

type App = ReturnType<typeof makeApp>;

function mkApp(): App {
	return makeApp({
		databaseUrl: DB_URL,
		sql,
		otpProvider: 'mock',
		isProduction: false,
		jwtSecret: 'test-secret',
	});
}

async function seedRequest(state: 'draft' | 'published', title: string): Promise<string> {
	const users = await sql<{ id: string }[]>`
		INSERT INTO users (email, password_hash) VALUES (${`feed-${title}@example.com`}, 'x')
		RETURNING id`;
	const authorId = (users[0] as { id: string }).id;
	const rows = await sql<{ id: string }[]>`
		INSERT INTO requests (author_id, title, goal, barrier, help_needed, state)
		VALUES (${authorId}, ${title}, 'goal', 'barrier', 'help', ${state})
		RETURNING id`;
	return (rows[0] as { id: string }).id;
}

beforeAll(async () => {
	sql = createClient(DB_URL);
});

afterAll(async () => {
	await sql.end();
});

beforeEach(async () => {
	await sql`TRUNCATE otp_tokens, sessions, users, requests CASCADE`;
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
