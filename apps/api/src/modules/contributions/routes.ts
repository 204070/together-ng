import { jwt } from '@elysiajs/jwt';
import { notifications } from '@together/db/schema';
import { ContributionComplete, ContributionConfirm, OutcomeSubmit, Value } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { createAuthGuard, type JwtVerifier, requireActiveActor } from '../../lib/authentication';
import { HttpError } from '../../lib/errors';
import type { ContributionServices } from './services';
import { toContributionResponse } from './store';

const VALID_STATUSES_FOR_COMPLETE = new Set(['in_progress']);
const VALID_STATUSES_FOR_CONFIRM = new Set(['completed']);
const VALID_STATUSES_FOR_OUTCOME = new Set(['completed']);

function notFound(message = 'Contribution not found'): HttpError {
	return new HttpError(404, 'NOT_FOUND', undefined, undefined, message);
}

function notParticipant(): HttpError {
	return new HttpError(
		403,
		'NOT_PARTICIPANT',
		undefined,
		undefined,
		'Not a participant in this contribution',
	);
}

function cannotConfirmOwnCompletion(): HttpError {
	return new HttpError(
		403,
		'CANNOT_CONFIRM_OWN_COMPLETION',
		undefined,
		undefined,
		'Cannot confirm your own completion',
	);
}

function cannotSubmitOwnOutcome(): HttpError {
	return new HttpError(
		403,
		'CANNOT_SUBMIT_OWN_OUTCOME',
		undefined,
		undefined,
		'Only the recipient can submit outcome confirmation',
	);
}

function invalidStatusForAction(action: string, status: string): HttpError {
	return new HttpError(
		422,
		'INVALID_STATUS',
		{ status, action },
		undefined,
		`Contribution cannot be ${action} in this status`,
	);
}

function alreadyConfirmed(): HttpError {
	return new HttpError(
		409,
		'ALREADY_CONFIRMED',
		undefined,
		undefined,
		'Completion already confirmed',
	);
}

function alreadySubmittedOutcome(): HttpError {
	return new HttpError(
		409,
		'OUTCOME_ALREADY_SUBMITTED',
		undefined,
		undefined,
		'Outcome already submitted',
	);
}

function collectIssues(schema: unknown, value: unknown): Record<string, string> {
	const issues: Record<string, string> = {};
	for (const e of Value.Errors(schema as never, value as never)) {
		const key = (e.path as string).replace(/^\//, '');
		if (key && !(key in issues)) {
			const tt = e.type as number | string;
			if (tt === 45) issues[key] = 'required';
			else if (tt === 50 || tt === 49) issues[key] = 'format';
			else if (tt === 52 || tt === 51) issues[key] = 'min_length';
			else if (tt === 42) issues[key] = 'additional_properties';
			else issues[key] = String(tt);
		}
	}
	return issues;
}

export function createContributionRouter(services: ContributionServices) {
	const store = services.store;

	return new Elysia()
		.use(jwt({ name: 'jwt', secret: services.jwtSecret, exp: '15m' }))
		.get(
			'/contributions/:id',
			async ({ params, headers, jwt: verifier }) => {
				let actorUserId: string | undefined;
				const authHeader = (headers as { authorization?: string }).authorization;
				if (authHeader?.startsWith('Bearer ')) {
					try {
						const actor = await requireActiveActor(
							headers as { authorization?: string },
							verifier as unknown as JwtVerifier,
							{ findUserById: services.findUserById },
						);
						actorUserId = actor.userId;
					} catch {
						actorUserId = undefined;
					}
				}

				const result = await store.findContributionWithRequest(params.id);
				if (!result) throw notFound();

				const isParticipant =
					actorUserId &&
					(result.contributorId === actorUserId || result.requestAuthorId === actorUserId);

				return toContributionResponse(result, { hideParticipant: !isParticipant });
			},
			{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
		)
		.use(
			new Elysia()
				.use(createAuthGuard({ findUserById: services.findUserById }, services.jwtSecret))
				.post(
					'/contributions/:id/complete',
					async ({ params, body, actor, set }) => {
						const userId = actor.userId;
						const contributionId = params.id;

						const result = await store.findContributionWithRequest(contributionId);
						if (!result) throw notFound();

						const isParticipant =
							result.contributorId === userId || result.requestAuthorId === userId;
						if (!isParticipant) throw notParticipant();

						if (!VALID_STATUSES_FOR_COMPLETE.has(result.status)) {
							throw invalidStatusForAction('completed', result.status);
						}

						const b = (body ?? {}) as Record<string, unknown>;
						if (!Value.Check(ContributionComplete, b)) {
							const issues = collectIssues(ContributionComplete, b);
							throw new HttpError(422, 'VALIDATION', issues, undefined, 'Invalid completion');
						}

						const updated = await store.updateContributionStatus(contributionId, 'completed', {
							completedAt: services.now(),
							notes: (b.notes as string | null) ?? undefined,
						});
						if (!updated) throw notFound();

						const notifyUserId =
							result.contributorId === userId ? result.requestAuthorId : result.contributorId;

						await services.db
							.insert(notifications)
							.values({
								userId: notifyUserId,
								requestId: result.requestId,
								type: 'contribution_completed',
								title: 'Contribution completed',
								body: 'A contribution has been marked as completed. Please confirm.',
								data: { contributionId },
							})
							.onConflictDoNothing({
								target: [notifications.requestId, notifications.userId],
							});

						set.status = 200;
						return toContributionResponse(updated);
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				)
				.post(
					'/contributions/:id/confirm',
					async ({ params, body, actor, set }) => {
						const userId = actor.userId;
						const contributionId = params.id;

						const result = await store.findContributionWithRequest(contributionId);
						if (!result) throw notFound();

						const isParticipant =
							result.contributorId === userId || result.requestAuthorId === userId;
						if (!isParticipant) throw notParticipant();

						if (result.contributorId === userId) {
							throw cannotConfirmOwnCompletion();
						}

						if (!VALID_STATUSES_FOR_CONFIRM.has(result.status)) {
							throw invalidStatusForAction('confirmed', result.status);
						}

						const existing = await store.findContributorConfirmation(contributionId);
						if (existing) throw alreadyConfirmed();

						const b = (body ?? {}) as Record<string, unknown>;
						if (!Value.Check(ContributionConfirm, b)) {
							const issues = collectIssues(ContributionConfirm, b);
							throw new HttpError(422, 'VALIDATION', issues, undefined, 'Invalid confirmation');
						}

						const confirmation = await store.createContributorConfirmation(
							contributionId,
							result.contributorId,
							b.completedAsAgreed as boolean,
						);

						await services.db
							.insert(notifications)
							.values({
								userId: result.contributorId,
								requestId: result.requestId,
								type: 'confirmation_required',
								title: 'Completion confirmed',
								body: 'Your completion has been confirmed.',
								data: { contributionId },
							})
							.onConflictDoNothing({
								target: [notifications.requestId, notifications.userId],
							});

						set.status = 201;
						return {
							id: confirmation.id,
							contributionId: confirmation.contributionId,
							contributorId: confirmation.contributorId,
							completedAsAgreed: confirmation.completedAsAgreed,
							createdAt: confirmation.createdAt.toISOString(),
						};
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				)
				.post(
					'/contributions/:id/outcome',
					async ({ params, body, actor, set }) => {
						const userId = actor.userId;
						const contributionId = params.id;

						const result = await store.findContributionWithRequest(contributionId);
						if (!result) throw notFound();

						if (result.requestAuthorId !== userId) {
							throw cannotSubmitOwnOutcome();
						}

						if (!VALID_STATUSES_FOR_OUTCOME.has(result.status)) {
							throw invalidStatusForAction('outcome-submitted', result.status);
						}

						const existing = await store.findOutcomeConfirmation(contributionId);
						if (existing) throw alreadySubmittedOutcome();

						const b = (body ?? {}) as Record<string, unknown>;
						if (!Value.Check(OutcomeSubmit, b)) {
							const issues = collectIssues(OutcomeSubmit, b);
							throw new HttpError(422, 'VALIDATION', issues, undefined, 'Invalid outcome');
						}

						const confirmation = await store.createOutcomeConfirmation(
							contributionId,
							userId,
							true,
							b.response as string,
							b.explanation as string | undefined,
						);

						await services.db
							.insert(notifications)
							.values({
								userId: result.contributorId,
								requestId: result.requestId,
								type: 'contribution_accepted',
								title: 'Outcome recorded',
								body: 'The recipient has recorded the outcome of your contribution.',
								data: { contributionId, response: b.response },
							})
							.onConflictDoNothing({
								target: [notifications.requestId, notifications.userId],
							});

						set.status = 201;
						return {
							id: confirmation.id,
							contributionId: confirmation.contributionId,
							recipientId: confirmation.recipientId,
							received: confirmation.received,
							response: confirmation.response,
							explanation: confirmation.explanation,
							createdAt: confirmation.createdAt.toISOString(),
						};
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				),
		);
}
