import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { migrate } from '@together/db';
import { createRequestFixture, makeTestApp } from '../testing/helpers';

const DB_URL =
	process.env.TEST_DATABASE_URL ??
	'postgresql://together:together@localhost:5433/together_wt7_test';

let app: ReturnType<typeof makeTestApp>;

beforeAll(async () => {
	await migrate(DB_URL);
});

beforeEach(() => {
	app = makeTestApp();
});

describe('GET /requests/featured', () => {
	test('returns { items: [] } on an empty database', async () => {
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ items: [] });
	});

	test('published request title and id appear in the response', async () => {
		const { id } = await createRequestFixture({ state: 'published', title: 'Feed seed title' });
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: Array<{ id: string; title: string }> };
		expect(body.items.map((item) => item.id)).toContain(id);
		expect(body.items.map((item) => item.title)).toContain('Feed seed title');
	});

	test('draft requests are excluded', async () => {
		await createRequestFixture({ state: 'draft', title: 'Draft stays hidden' });
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(await res.json()).toEqual({ items: [] });
	});

	test('literal /requests/featured wins over GET /requests/:id', async () => {
		await createRequestFixture({ state: 'published', title: 'Literal route title' });
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(Array.isArray(body.items)).toBe(true);
	});
});
