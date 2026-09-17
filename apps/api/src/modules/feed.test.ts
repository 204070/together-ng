import { beforeEach, describe, expect, test } from 'bun:test';
import { createRequestFixture, makeTestApp } from '../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

describe('GET /requests/featured', () => {
	test('returns array of items from featured feed', async () => {
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(Array.isArray(body.items)).toBe(true);
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
		const { id } = await createRequestFixture({ state: 'draft', title: 'Draft stays hidden' });
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((item) => item.id)).not.toContain(id);
	});

	test('literal /requests/featured wins over GET /requests/:id', async () => {
		await createRequestFixture({ state: 'published', title: 'Literal route title' });
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(Array.isArray(body.items)).toBe(true);
	});
});
