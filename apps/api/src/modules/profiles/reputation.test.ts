import { beforeEach, describe, expect, test } from 'bun:test';
import { getDatabase } from '../../infra/database';
import { contributions, outcomeConfirmations } from '../../infra/database/schema';
import { createRequestFixture, makeTestApp, userAuth } from '../../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

async function createProfileForUser(
	headers: { authorization: string },
	name = 'Test User',
): Promise<{ id: string; userId: string }> {
	const res = await app.handle(
		new Request('http://localhost/profiles', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ name }),
		}),
	);
	const body = (await res.json()) as { id: string; userId: string };
	return { id: body.id, userId: body.userId };
}

async function createContributionFixture(
	requestId: string,
	contributorId: string,
	status: string = 'completed',
): Promise<string> {
	const db = getDatabase();
	const [row] = await db
		.insert(contributions)
		.values({
			requestId,
			contributorId,
			responseId: null,
			status: status as 'accepted' | 'in_progress' | 'completed' | 'cancelled',
		})
		.returning();
	return row!.id;
}

async function createOutcomeConfirmation(
	contributionId: string,
	recipientId: string,
	response: string = 'yes_significantly',
): Promise<void> {
	const db = getDatabase();
	await db.insert(outcomeConfirmations).values({
		contributionId,
		recipientId,
		received: true,
		response: response as 'yes_significantly' | 'yes_somewhat' | 'not_yet' | 'no',
	});
}

describe('GET /profiles/:id reputation fields', () => {
	test('profile returns zero counts for user with no contributions', async () => {
		const contributor = await userAuth();
		const { id: profileId } = await createProfileForUser(contributor.headers);

		const res = await app.handle(new Request(`http://localhost/profiles/${profileId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.peopleHelped).toBe(0);
		expect(body.successfulContributions).toBe(0);
		expect(body.contributorSince).toBeNull();
	});

	test('profile shows contributorSince from earliest contribution', async () => {
		const contributor = await userAuth();
		const { id: profileId } = await createProfileForUser(contributor.headers);
		const { id: requestId } = await createRequestFixture({ state: 'published' });

		await createContributionFixture(requestId, contributor.user.id);

		const res = await app.handle(new Request(`http://localhost/profiles/${profileId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.contributorSince).toBeDefined();
		expect(typeof body.contributorSince).toBe('string');
	});

	test('profile counts people helped from outcome confirmations', async () => {
		const contributor = await userAuth();
		const recipient = await userAuth();
		const { id: profileId } = await createProfileForUser(contributor.headers);
		const { id: requestId } = await createRequestFixture({ state: 'published' });

		const contributionId = await createContributionFixture(requestId, contributor.user.id);
		await createOutcomeConfirmation(contributionId, recipient.user.id);

		const res = await app.handle(new Request(`http://localhost/profiles/${profileId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.peopleHelped).toBe(1);
		expect(body.successfulContributions).toBe(1);
	});

	test('profile counts distinct recipients for peopleHelped', async () => {
		const contributor = await userAuth();
		const recipient1 = await userAuth();
		const recipient2 = await userAuth();
		const { id: profileId } = await createProfileForUser(contributor.headers);

		const { id: req1 } = await createRequestFixture({ state: 'published' });
		const { id: req2 } = await createRequestFixture({ state: 'published' });

		const contrib1 = await createContributionFixture(req1, contributor.user.id);
		const contrib2 = await createContributionFixture(req2, contributor.user.id);

		await createOutcomeConfirmation(contrib1, recipient1.user.id);
		await createOutcomeConfirmation(contrib2, recipient2.user.id);

		const res = await app.handle(new Request(`http://localhost/profiles/${profileId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.peopleHelped).toBe(2);
		expect(body.successfulContributions).toBe(2);
	});

	test('same recipient counted once for peopleHelped', async () => {
		const contributor = await userAuth();
		const recipient = await userAuth();
		const { id: profileId } = await createProfileForUser(contributor.headers);

		const { id: req1 } = await createRequestFixture({ state: 'published' });
		const { id: req2 } = await createRequestFixture({ state: 'published' });

		const contrib1 = await createContributionFixture(req1, contributor.user.id);
		const contrib2 = await createContributionFixture(req2, contributor.user.id);

		await createOutcomeConfirmation(contrib1, recipient.user.id);
		await createOutcomeConfirmation(contrib2, recipient.user.id);

		const res = await app.handle(new Request(`http://localhost/profiles/${profileId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.peopleHelped).toBe(1);
		expect(body.successfulContributions).toBe(2);
	});

	test('contribution without outcome confirmation not counted', async () => {
		const contributor = await userAuth();
		const { id: profileId } = await createProfileForUser(contributor.headers);
		const { id: requestId } = await createRequestFixture({ state: 'published' });

		await createContributionFixture(requestId, contributor.user.id, 'completed');

		const res = await app.handle(new Request(`http://localhost/profiles/${profileId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.peopleHelped).toBe(0);
		expect(body.successfulContributions).toBe(0);
	});

	test('GET /profiles/me includes reputation fields', async () => {
		const contributor = await userAuth();
		await createProfileForUser(contributor.headers);

		const res = await app.handle(
			new Request('http://localhost/profiles/me', {
				headers: contributor.headers,
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.peopleHelped).toBe(0);
		expect(body.successfulContributions).toBe(0);
		expect(body.contributorSince).toBeNull();
	});

	test('profile does not display monetary balance or points', async () => {
		const contributor = await userAuth();
		const { id: profileId } = await createProfileForUser(contributor.headers);

		const res = await app.handle(new Request(`http://localhost/profiles/${profileId}`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.balance).toBeUndefined();
		expect(body.points).toBeUndefined();
		expect(body.credits).toBeUndefined();
		expect(body.coins).toBeUndefined();
	});
});
