import { beforeEach, describe, expect, test } from 'bun:test';
import { and, eq, getDatabase } from '@together/db';
import { notifications } from '@together/db/schema';
import { createRequestFixture, makeTestApp, userAuth } from '../../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

describe('PATCH /requests/:id (published/receiving_responses editing)', () => {
	test('author can edit a published request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			title: 'Original Title',
			goal: 'Original goal',
			barrier: 'Original barrier',
			helpNeeded: 'Original help',
			state: 'published',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ title: 'Updated Title' }),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.title).toBe('Updated Title');
	});

	test('author can edit a receiving_responses request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			title: 'Original Title',
			goal: 'Original goal',
			barrier: 'Original barrier',
			helpNeeded: 'Original help',
			state: 'receiving_responses',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ title: 'Updated Title' }),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.title).toBe('Updated Title');
	});

	test('cannot edit a completed request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'completed',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ title: 'Updated' }),
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('CANNOT_EDIT');
	});

	test('cannot edit a closed request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'closed',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ title: 'Updated' }),
			}),
		);
		expect(res.status).toBe(422);
	});

	test('cannot edit a cancelled request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'cancelled',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ title: 'Updated' }),
			}),
		);
		expect(res.status).toBe(422);
	});

	test('non-owner cannot edit', async () => {
		const { id: requestId } = await createRequestFixture({
			state: 'published',
		});
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ title: 'Hacked' }),
			}),
		);
		expect(res.status).toBe(403);
	});

	test('unauthenticated user gets 401', async () => {
		const { id: requestId } = await createRequestFixture({
			state: 'published',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title: 'Updated' }),
			}),
		);
		expect(res.status).toBe(401);
	});

	test('major edit notifies existing responders', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			goal: 'I need help learning to solder',
			barrier: 'No equipment or guidance nearby',
			helpNeeded: 'Someone patient to teach me basics',
			state: 'receiving_responses',
		});

		const contributor = await userAuth();

		// Contributor submits an offer
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);

		// Author makes a major edit (complete rewrite of fundamental fields)
		await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({
					goal: 'Completely different goal about building furniture',
					barrier: 'Need workshop space and tools',
					helpNeeded: 'Experienced carpenter with workshop access',
				}),
			}),
		);

		// Check notification was created
		const [notification] = await getDatabase()
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.userId, contributor.user.id),
					eq(notifications.type, 'request_update'),
				),
			);
		expect(notification).toBeDefined();
		expect(notification!.title).toBe('Request updated');
	});

	test('minor edit does not notify responders', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			goal: 'I need help learning to solder',
			barrier: 'No equipment or guidance nearby',
			helpNeeded: 'Someone patient to teach me basics',
			state: 'receiving_responses',
		});

		const contributor = await userAuth();

		// Contributor submits an offer
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);

		// Author makes a minor edit (just a typo fix)
		await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({
					goal: 'I need help learning to solder electronics',
				}),
			}),
		);

		// Check no notification was created
		const [notification] = await getDatabase()
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.userId, contributor.user.id),
					eq(notifications.type, 'request_update'),
				),
			);
		expect(notification).toBeUndefined();
	});
});

describe('POST /requests/:id/close', () => {
	test('author can close a published request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'published',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ reason: 'Found help elsewhere' }),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('closed');
		expect(body.closedReason).toBe('Found help elsewhere');
		expect(body.closedAt).toBeDefined();
	});

	test('author can close a receiving_responses request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'receiving_responses',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('closed');
	});

	test('author can close a completed request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'completed',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ reason: 'Done' }),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('closed');
		expect(body.closedReason).toBe('Done');
	});

	test('non-owner cannot close', async () => {
		const { id: requestId } = await createRequestFixture({
			state: 'published',
		});
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('NOT_REQUEST_OWNER');
	});

	test('unauthenticated user gets 401', async () => {
		const { id: requestId } = await createRequestFixture({
			state: 'published',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(401);
	});

	test('cannot close an archived request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'archived',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('INVALID_STATE_TRANSITION');
	});

	test('close notifies existing responders', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'published',
		});

		const contributor = await userAuth();

		// Contributor submits an offer
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);

		// Author closes the request
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ reason: 'No longer needed' }),
			}),
		);

		// Check notification was created
		const [notification] = await getDatabase()
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.userId, contributor.user.id),
					eq(notifications.type, 'request_closed'),
				),
			);
		expect(notification).toBeDefined();
		expect(notification!.title).toBe('Request closed');
	});

	test('non-existent request returns 404', async () => {
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request('http://localhost/requests/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/close', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(404);
	});
});

describe('POST /requests/:id/cancel', () => {
	test('author can cancel a published request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'published',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/cancel`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('cancelled');
	});

	test('author can cancel a receiving_responses request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'receiving_responses',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/cancel`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('cancelled');
	});

	test('author can cancel a help_arranged request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'help_arranged',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/cancel`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('cancelled');
	});

	test('non-owner cannot cancel', async () => {
		const { id: requestId } = await createRequestFixture({
			state: 'published',
		});
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/cancel`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(403);
	});

	test('unauthenticated user gets 401', async () => {
		const { id: requestId } = await createRequestFixture({
			state: 'published',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/cancel`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
			}),
		);
		expect(res.status).toBe(401);
	});

	test('cannot cancel an archived request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'archived',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/cancel`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(409);
	});

	test('cancel notifies existing responders', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'published',
		});

		const contributor = await userAuth();

		// Contributor submits an offer
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);

		// Author cancels the request
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/cancel`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);

		// Check notification was created
		const [notification] = await getDatabase()
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.userId, contributor.user.id),
					eq(notifications.type, 'request_cancelled'),
				),
			);
		expect(notification).toBeDefined();
		expect(notification!.title).toBe('Request cancelled');
	});

	test('non-existent request returns 404', async () => {
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request('http://localhost/requests/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/cancel', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(404);
	});
});

describe('POST /requests/:id/archive', () => {
	test('author can archive a closed request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'closed',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('archived');
	});

	test('author can archive a cancelled request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'cancelled',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('archived');
	});

	test('author can archive a completed request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'completed',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('archived');
	});

	test('author can archive a published request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'published',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.state).toBe('archived');
	});

	test('non-owner cannot archive', async () => {
		const { id: requestId } = await createRequestFixture({
			state: 'published',
		});
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(403);
	});

	test('unauthenticated user gets 401', async () => {
		const { id: requestId } = await createRequestFixture({
			state: 'published',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
			}),
		);
		expect(res.status).toBe(401);
	});

	test('cannot archive an already archived request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'archived',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(409);
	});

	test('non-existent request returns 404', async () => {
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request('http://localhost/requests/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/archive', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);
		expect(res.status).toBe(404);
	});
});

describe('State machine transitions', () => {
	test('completed -> closed is allowed', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'completed',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(200);
	});

	test('closed -> archived is allowed', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'closed',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
	});

	test('cancelled -> archived is allowed', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'cancelled',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
	});

	test('draft -> cancelled is allowed', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'draft',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/cancel`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
	});

	test('draft -> archived is allowed', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'draft',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/archive`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
			}),
		);
		expect(res.status).toBe(200);
	});

	test('in_progress -> closed is allowed', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'in_progress',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(200);
	});

	test('help_arranged -> closed is allowed', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({
			state: 'help_arranged',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/close`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(200);
	});
});
