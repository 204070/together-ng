import { beforeEach, describe, expect, test } from 'bun:test';
import { createRequestFixture, makeTestApp, userAuth } from '../../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

describe('GET /requests/:id (Discovery & Social cards access)', () => {
	test('unauthenticated visitor can view a published request', async () => {
		const { id: requestId } = await createRequestFixture({
			title: 'Solar Panel Setup',
			goal: 'Install solar for school',
			barrier: 'Need technician',
			helpNeeded: 'Guidance',
			state: 'published',
		});

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
		const { id: requestId } = await createRequestFixture({
			title: 'Book Donation',
			goal: 'Gather books',
			barrier: 'Transport',
			helpNeeded: 'Van driver',
			state: 'published',
		});
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBe(requestId);
		expect(body.qualityHints).toBeUndefined();
	});

	test('author viewing their own request receives quality hints', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			title: 'Laptop Needed',
			goal: 'I need a laptop',
			barrier: 'No funds',
			helpNeeded: 'Used laptop',
			state: 'published',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers: authorAuth.headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBe(requestId);
		expect(Array.isArray(body.qualityHints)).toBe(true);
	});

	test('unauthenticated visitor receives 404 for a draft request', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'draft' });

		const res = await app.handle(new Request(`http://localhost/requests/${requestId}`));
		expect(res.status).toBe(404);
	});

	test('different authenticated user receives 404 for a draft request', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'draft' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers,
			}),
		);
		expect(res.status).toBe(404);
	});

	test('author can view their own draft request with quality hints', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'draft' });

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers: authorAuth.headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBe(requestId);
		expect(body.state).toBe('draft');
		expect(Array.isArray(body.qualityHints)).toBe(true);
	});
});
