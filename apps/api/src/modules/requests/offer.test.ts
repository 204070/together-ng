import { beforeEach, describe, expect, test } from 'bun:test';
import { and, eq, getDatabase } from '@together/db';
import { notifications, requestResponses } from '@together/db/schema';
import { createRequestFixture, makeTestApp, userAuth } from '../../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

describe('POST /requests/:id/offers', () => {
	test('authenticated non-owner can submit an offer on a published request', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help with this!' }),
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBeDefined();
		expect(body.requestId).toBe(requestId);
		expect(body.message).toBe('I can help with this!');
		expect(body.status).toBe('pending');
		expect(body.anonymous).toBe(false);
		expect(body.contributorId).toBeDefined();
	});

	test('authenticated non-owner can submit an offer on a receiving_responses request', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'receiving_responses' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		expect(res.status).toBe(201);
	});

	test('offer with anonymous flag works', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help!', anonymous: true }),
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.anonymous).toBe(true);
	});

	test('offer with modality works', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help online!', modality: 'online' }),
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.modality).toBe('online');
	});

	test('duplicate offer returns 409', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'First offer' }),
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'Second offer' }),
			}),
		);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('ALREADY_OFFERED');
	});

	test('owner cannot submit an offer on their own request', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ message: 'Help myself!' }),
			}),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('CANNOT_OFFER_OWN_REQUEST');
	});

	test('unauthenticated user gets 401', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		expect(res.status).toBe(401);
	});

	test('non-existent request returns 404', async () => {
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request('http://localhost/requests/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/offers', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		expect(res.status).toBe(404);
	});

	test('draft request returns 422', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'draft' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('OFFER_NOT_ALLOWED');
	});

	test('closed request returns 422', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'closed' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('OFFER_NOT_ALLOWED');
	});

	test('empty message returns 422', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: '' }),
			}),
		);
		expect(res.status).toBe(422);
	});

	test('DB row is created correctly', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { user, headers } = await userAuth();

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'Test offer' }),
			}),
		);

		const [result] = await getDatabase()
			.select()
			.from(requestResponses)
			.where(
				and(eq(requestResponses.requestId, requestId), eq(requestResponses.contributorId, user.id)),
			);
		expect(result).toBeDefined();
		expect(result!.message).toBe('Test offer');
		expect(result!.status).toBe('pending');
	});
});

describe('GET /requests/:id/offers', () => {
	test('owner sees all offers', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const contributor1 = await userAuth();
		const contributor2 = await userAuth();

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor1.headers },
				body: JSON.stringify({ message: 'Offer 1' }),
			}),
		);
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor2.headers },
				body: JSON.stringify({ message: 'Offer 2' }),
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				headers: authorAuth.headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { offers: Array<Record<string, unknown>>; total: number };
		expect(body.offers).toHaveLength(2);
		expect(body.offers.map((o) => o.message).sort()).toEqual(['Offer 1', 'Offer 2']);
	});

	test('contributor sees only their own offers', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor1 = await userAuth();
		const contributor2 = await userAuth();

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor1.headers },
				body: JSON.stringify({ message: 'Offer 1' }),
			}),
		);
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor2.headers },
				body: JSON.stringify({ message: 'Offer 2' }),
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				headers: contributor1.headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { offers: Array<Record<string, unknown>>; total: number };
		expect(body.offers).toHaveLength(1);
		expect(body.offers[0]!.message).toBe('Offer 1');
		expect(body.total).toBe(1);
	});

	test('non-participant sees count only', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();
		const stranger = await userAuth();

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'Offer 1' }),
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				headers: stranger.headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { offers: Array<Record<string, unknown>>; total: number };
		expect(body.offers).toHaveLength(0);
		expect(body.total).toBe(1);
	});

	test('unauthenticated user sees count only', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'Offer 1' }),
			}),
		);

		const res = await app.handle(new Request(`http://localhost/requests/${requestId}/offers`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { offers: Array<Record<string, unknown>>; total: number };
		expect(body.offers).toHaveLength(0);
		expect(body.total).toBe(1);
	});

	test('non-existent request returns 404', async () => {
		const res = await app.handle(
			new Request('http://localhost/requests/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/offers'),
		);
		expect(res.status).toBe(404);
	});

	test('empty offers returns empty array with zero total', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });

		const res = await app.handle(new Request(`http://localhost/requests/${requestId}/offers`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { offers: Array<Record<string, unknown>>; total: number };
		expect(body.offers).toHaveLength(0);
		expect(body.total).toBe(0);
	});
});

describe('POST /requests/:id/offers/:offerId/accept', () => {
	test('owner can accept a pending offer', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/accept`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.status).toBe('accepted');
	});

	test('accept transitions request to help_arranged', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/accept`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);

		const reqRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers: authorAuth.headers,
			}),
		);
		const reqBody = (await reqRes.json()) as Record<string, unknown>;
		expect(reqBody.state).toBe('help_arranged');
	});

	test('accept sends notification to contributor', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/accept`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);

		const [notification] = await getDatabase()
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.userId, contributor.user.id),
					eq(notifications.type, 'response_accepted'),
				),
			);
		expect(notification).toBeDefined();
		expect(notification!.title).toBe('Your offer was accepted');
	});

	test('non-owner cannot accept an offer', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();
		const stranger = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/accept`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...stranger.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('NOT_REQUEST_OWNER');
	});

	test('cannot accept a non-pending offer', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		// Accept first
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/accept`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);

		// Try to accept again
		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/accept`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('INVALID_OFFER_STATUS');
	});

	test('non-existent offer returns 404', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });

		const res = await app.handle(
			new Request(
				`http://localhost/requests/${requestId}/offers/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d/accept`,
				{
					method: 'POST',
					headers: { 'content-type': 'application/json', ...authorAuth.headers },
					body: JSON.stringify({}),
				},
			),
		);
		expect(res.status).toBe(404);
	});
});

describe('POST /requests/:id/offers/:offerId/decline', () => {
	test('owner can decline a pending offer', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/decline`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.status).toBe('declined');
	});

	test('decline sends notification to contributor', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/decline`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);

		const [notification] = await getDatabase()
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.userId, contributor.user.id),
					eq(notifications.type, 'response_declined'),
				),
			);
		expect(notification).toBeDefined();
		expect(notification!.title).toBe('Your offer was declined');
	});

	test('non-owner cannot decline an offer', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();
		const stranger = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/decline`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...stranger.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('NOT_REQUEST_OWNER');
	});

	test('cannot decline a non-pending offer', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		// Decline first
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/decline`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);

		// Try to decline again
		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/decline`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('INVALID_OFFER_STATUS');
	});

	test('unauthenticated decline returns 401', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();

		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		const res = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/decline`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(401);
	});
});

describe('Offer flow integration', () => {
	test('multiple contributors can submit offers, owner reviews them', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const contributor1 = await userAuth();
		const contributor2 = await userAuth();

		// Both submit offers
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor1.headers },
				body: JSON.stringify({ message: 'I can help with part 1' }),
			}),
		);
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor2.headers },
				body: JSON.stringify({ message: 'I can help with part 2' }),
			}),
		);

		// Owner sees both
		const listRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				headers: authorAuth.headers,
			}),
		);
		const listBody = (await listRes.json()) as { offers: Array<Record<string, unknown>> };
		expect(listBody.offers).toHaveLength(2);

		// Accept one, decline the other
		const offer1 = listBody.offers[0]!;
		const offer2 = listBody.offers[1]!;

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer1.id}/accept`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer2.id}/decline`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);

		// Verify final state
		const finalListRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				headers: authorAuth.headers,
			}),
		);
		const finalBody = (await finalListRes.json()) as {
			offers: Array<Record<string, unknown>>;
		};
		const accepted = finalBody.offers.find((o) => o.id === offer1.id);
		const declined = finalBody.offers.find((o) => o.id === offer2.id);
		expect(accepted?.status).toBe('accepted');
		expect(declined?.status).toBe('declined');
	});

	test('request state transitions correctly through offer flow', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		// Submit offer
		const offerRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
				body: JSON.stringify({ message: 'I can help!' }),
			}),
		);
		const offer = (await offerRes.json()) as { id: string };

		// Accept -> should transition to help_arranged
		await app.handle(
			new Request(`http://localhost/requests/${requestId}/offers/${offer.id}/accept`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);

		const reqRes = await app.handle(
			new Request(`http://localhost/requests/${requestId}`, {
				headers: authorAuth.headers,
			}),
		);
		const reqBody = (await reqRes.json()) as Record<string, unknown>;
		expect(reqBody.state).toBe('help_arranged');
	});
});
