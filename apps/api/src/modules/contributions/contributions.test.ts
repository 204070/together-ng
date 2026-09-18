import { beforeEach, describe, expect, test } from 'bun:test';
import { and, eq, getDatabase } from '@together/db';
import {
	contributions,
	contributorConfirmations,
	notifications,
	outcomeConfirmations,
} from '@together/db/schema';
import { createRequestFixture, makeTestApp, userAuth } from '../../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

async function createContributionFixture(
	requestId: string,
	contributorId: string,
	responseId?: string,
	status: string = 'in_progress',
): Promise<string> {
	const db = getDatabase();
	const [row] = await db
		.insert(contributions)
		.values({
			requestId,
			contributorId,
			responseId: responseId ?? null,
			status: status as 'accepted' | 'in_progress' | 'completed' | 'cancelled',
		})
		.returning();
	return row!.id;
}

describe('GET /contributions/:id', () => {
	test('participant can see full contribution details', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}`, {
				headers: contributor.headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.id).toBe(contributionId);
		expect(body.requestId).toBe(requestId);
		expect(body.contributorId).toBe(contributor.user.id);
	});

	test('non-participant cannot see contributor details', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();
		const stranger = await userAuth();

		const contributionId = await createContributionFixture(requestId, contributor.user.id);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}`, {
				headers: stranger.headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.contributorId).toBeNull();
	});

	test('non-existent contribution returns 404', async () => {
		const res = await app.handle(
			new Request('http://localhost/contributions/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'),
		);
		expect(res.status).toBe(404);
	});
});

describe('POST /contributions/:id/complete', () => {
	test('contributor can mark contribution as complete', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ notes: 'Done!' }),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.status).toBe('completed');
		expect(body.completedAt).toBeDefined();
		expect(body.notes).toBe('Done!');
	});

	test('request owner can mark contribution as complete', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.status).toBe('completed');
	});

	test('non-participant cannot mark as complete', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();
		const stranger = await userAuth();

		const contributionId = await createContributionFixture(requestId, contributor.user.id);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...stranger.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('NOT_PARTICIPANT');
	});

	test('cannot complete a contribution not in_progress', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			undefined,
			'accepted',
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('INVALID_STATUS');
	});

	test('completion sends notification to the other participant', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();

		const contributionId = await createContributionFixture(requestId, contributor.user.id);

		await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({}),
			}),
		);

		const [notification] = await getDatabase()
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.userId, authorAuth.user.id),
					eq(notifications.type, 'contribution_completed'),
				),
			);
		expect(notification).toBeDefined();
		expect(notification!.title).toBe('Contribution completed');
	});

	test('unauthenticated user gets 401', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();
		const contributionId = await createContributionFixture(requestId, contributor.user.id);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(401);
	});
});

describe('POST /contributions/:id/confirm', () => {
	test('request owner can confirm contributor completion', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
		);

		await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({}),
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/confirm`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ completedAsAgreed: true }),
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.completedAsAgreed).toBe(true);
		expect(body.contributorId).toBe(contributor.user.id);
	});

	test('contributor cannot confirm their own completion', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
		);

		await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({}),
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/confirm`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ completedAsAgreed: true }),
			}),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('CANNOT_CONFIRM_OWN_COMPLETION');
	});

	test('cannot confirm twice', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
		);

		await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({}),
			}),
		);

		await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/confirm`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ completedAsAgreed: true }),
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/confirm`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ completedAsAgreed: true }),
			}),
		);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('ALREADY_CONFIRMED');
	});

	test('confirmation sends notification to contributor', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
		);

		await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({}),
			}),
		);

		await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/confirm`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ completedAsAgreed: true }),
			}),
		);

		const [confirmation] = await getDatabase()
			.select()
			.from(contributorConfirmations)
			.where(eq(contributorConfirmations.contributionId, contributionId));
		expect(confirmation).toBeDefined();
		expect(confirmation!.completedAsAgreed).toBe(true);
	});
});

describe('POST /contributions/:id/outcome', () => {
	test('request owner can submit outcome confirmation', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
			'completed',
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/outcome`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({
					response: 'yes_significantly',
					explanation: 'This helped me a lot!',
				}),
			}),
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.response).toBe('yes_significantly');
		expect(body.explanation).toBe('This helped me a lot!');
		expect(body.received).toBe(true);
	});

	test('contributor cannot submit outcome', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
			'completed',
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/outcome`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ response: 'yes_significantly' }),
			}),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('CANNOT_SUBMIT_OWN_OUTCOME');
	});

	test('cannot submit outcome twice', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
			'completed',
		);

		await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/outcome`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ response: 'yes_significantly' }),
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/outcome`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ response: 'yes_somewhat' }),
			}),
		);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('OUTCOME_ALREADY_SUBMITTED');
	});

	test('cannot submit outcome for non-completed contribution', async () => {
		const { id: requestId, authorAuth } = await createRequestFixture({ state: 'published' });
		const contributor = await userAuth();

		const contributionId = await createContributionFixture(requestId, contributor.user.id);

		const res = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/outcome`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ response: 'yes_significantly' }),
			}),
		);
		expect(res.status).toBe(422);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('INVALID_STATUS');
	});

	test('outcome sends notification to contributor', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
			'completed',
		);

		await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/outcome`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ response: 'yes_significantly' }),
			}),
		);

		const [outcome] = await getDatabase()
			.select()
			.from(outcomeConfirmations)
			.where(eq(outcomeConfirmations.contributionId, contributionId));
		expect(outcome).toBeDefined();
		expect(outcome!.response).toBe('yes_significantly');
	});
});

describe('Contribution lifecycle integration', () => {
	test('full lifecycle: complete → confirm → outcome', async () => {
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

		const contributionId = await createContributionFixture(
			requestId,
			contributor.user.id,
			offer.id,
		);

		// 1. Contributor completes
		const completeRes = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...contributor.headers },
				body: JSON.stringify({ notes: 'All done!' }),
			}),
		);
		expect(completeRes.status).toBe(200);
		const completeBody = (await completeRes.json()) as { status: string };
		expect(completeBody.status).toBe('completed');

		// 2. Owner confirms
		const confirmRes = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/confirm`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({ completedAsAgreed: true }),
			}),
		);
		expect(confirmRes.status).toBe(201);

		// 3. Owner submits outcome
		const outcomeRes = await app.handle(
			new Request(`http://localhost/contributions/${contributionId}/outcome`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...authorAuth.headers },
				body: JSON.stringify({
					response: 'yes_significantly',
					explanation: 'Great help!',
				}),
			}),
		);
		expect(outcomeRes.status).toBe(201);
		const outcomeBody = (await outcomeRes.json()) as { response: string };
		expect(outcomeBody.response).toBe('yes_significantly');
	});
});
