import { jwt } from '@elysiajs/jwt';
import { notifications } from '@together/db/schema';
import { OfferAction, OfferCreate, Value } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { createAuthGuard, type JwtVerifier, requireActiveActor } from '../../lib/authentication';
import { HttpError } from '../../lib/errors';
import type { RequestServices } from './services';
import { canTransition } from './state';
import { toOfferResponse } from './store';

const OFFERABLE_STATES = new Set(['published', 'receiving_responses']);

function notFound(message = 'Request not found'): HttpError {
	return new HttpError(404, 'NOT_FOUND', undefined, undefined, message);
}

function offerNotFound(): HttpError {
	return new HttpError(404, 'OFFER_NOT_FOUND', undefined, undefined, 'Offer not found');
}

function cannotOfferOnOwnRequest(): HttpError {
	return new HttpError(
		403,
		'CANNOT_OFFER_OWN_REQUEST',
		undefined,
		undefined,
		'Cannot submit an offer on your own request',
	);
}

function notRequestOwner(): HttpError {
	return new HttpError(403, 'NOT_REQUEST_OWNER', undefined, undefined, 'Not the request owner');
}

function offerNotAllowedInState(state: string): HttpError {
	return new HttpError(
		422,
		'OFFER_NOT_ALLOWED',
		{ state },
		undefined,
		'Offers are not allowed in this state',
	);
}

function duplicateOffer(): HttpError {
	return new HttpError(409, 'ALREADY_OFFERED', undefined, undefined, 'Already submitted an offer');
}

function invalidOfferStatus(status: string): HttpError {
	return new HttpError(
		422,
		'INVALID_OFFER_STATUS',
		{ status },
		undefined,
		'Offer cannot be acted on in this status',
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

export function createOfferRouter(services: RequestServices) {
	const store = services.store;
	const limiter = services.limiter;

	return new Elysia()
		.use(jwt({ name: 'jwt', secret: services.jwtSecret, exp: '15m' }))
		.get(
			'/requests/:id/offers',
			async ({ params, headers, jwt: verifier, set }) => {
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

				const request = await store.findRequestById(params.id);
				if (!request) throw notFound();

				const isOwner = actorUserId && request.authorId === actorUserId;

				if (isOwner) {
					const offers = await store.listOffersForRequest(params.id);
					set.status = 200;
					return {
						offers: offers.map((o) => toOfferResponse(o)),
						total: offers.length,
					};
				}

				if (actorUserId) {
					const myOffers = await store.listOffersByContributor(actorUserId);
					const requestOffers = myOffers.filter((o) => o.requestId === params.id);
					if (requestOffers.length > 0) {
						set.status = 200;
						return {
							offers: requestOffers.map((o) => toOfferResponse(o)),
							total: requestOffers.length,
						};
					}
				}

				const count = await store.countOffersForRequest(params.id);
				set.status = 200;
				return { offers: [], total: count };
			},
			{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
		)
		.use(
			new Elysia()
				.use(createAuthGuard({ findUserById: services.findUserById }, services.jwtSecret))
				.post(
					'/requests/:id/offers',
					async ({ params, body, actor, set }) => {
						const userId = actor.userId;
						const requestId = params.id;

						const lim = await limiter.check(`offer:${userId}`);
						if (!lim.allowed)
							throw new HttpError(
								429,
								'RATE_LIMITED',
								undefined,
								lim.retryAfterSeconds,
								'Too many requests',
							);

						const request = await store.findRequestById(requestId);
						if (!request) throw notFound();

						if (request.authorId === userId) throw cannotOfferOnOwnRequest();

						if (!OFFERABLE_STATES.has(request.state)) {
							throw offerNotAllowedInState(request.state);
						}

						const existing = await store.findOfferByContributor(requestId, userId);
						if (existing) throw duplicateOffer();

						const b = (body ?? {}) as Record<string, unknown>;
						if (!Value.Check(OfferCreate, b)) {
							const issues = collectIssues(OfferCreate, b);
							throw new HttpError(422, 'VALIDATION', issues, undefined, 'Invalid offer');
						}

						const offer = await store.createOffer(requestId, userId, {
							message: b.message as string,
							anonymous: b.anonymous as boolean | undefined,
							modality: b.modality as string | undefined,
						});

						set.status = 201;
						return toOfferResponse(offer);
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				)
				.post(
					'/requests/:id/offers/:offerId/accept',
					async ({ params, body, actor, set }) => {
						const userId = actor.userId;
						const { id: requestId, offerId } = params;

						const request = await store.findRequestById(requestId);
						if (!request) throw notFound();
						if (request.authorId !== userId) throw notRequestOwner();

						const offer = await store.findOfferById(offerId);
						if (!offer || offer.requestId !== requestId) throw offerNotFound();

						if (offer.status !== 'pending') throw invalidOfferStatus(offer.status);

						const b = (body ?? {}) as Record<string, unknown>;
						if (b && !Value.Check(OfferAction, b)) {
							const issues = collectIssues(OfferAction, b);
							throw new HttpError(422, 'VALIDATION', issues, undefined, 'Invalid action');
						}

						const accepted = await store.updateOfferStatus(offerId, 'accepted');
						if (!accepted) throw offerNotFound();

						if (canTransition(request.state, 'help_arranged')) {
							await store.updateRequest(requestId, { state: 'help_arranged' });
						}

						// Notify the contributor
						await services.db
							.insert(notifications)
							.values({
								userId: offer.contributorId,
								requestId,
								type: 'response_accepted',
								title: `Your offer was accepted`,
								body: `Your offer for "${request.title}" has been accepted.`,
								data: { offerId },
							})
							.onConflictDoNothing({
								target: [notifications.requestId, notifications.userId],
							});

						set.status = 200;
						return toOfferResponse(accepted);
					},
					{
						params: t.Object({
							id: t.String({ format: 'uuid' }),
							offerId: t.String({ format: 'uuid' }),
						}),
					},
				)
				.post(
					'/requests/:id/offers/:offerId/decline',
					async ({ params, body, actor, set }) => {
						const userId = actor.userId;
						const { id: requestId, offerId } = params;

						const request = await store.findRequestById(requestId);
						if (!request) throw notFound();
						if (request.authorId !== userId) throw notRequestOwner();

						const offer = await store.findOfferById(offerId);
						if (!offer || offer.requestId !== requestId) throw offerNotFound();

						if (offer.status !== 'pending') throw invalidOfferStatus(offer.status);

						const b = (body ?? {}) as Record<string, unknown>;
						if (b && !Value.Check(OfferAction, b)) {
							const issues = collectIssues(OfferAction, b);
							throw new HttpError(422, 'VALIDATION', issues, undefined, 'Invalid action');
						}

						const declined = await store.updateOfferStatus(offerId, 'declined');
						if (!declined) throw offerNotFound();

						// Notify the contributor
						await services.db
							.insert(notifications)
							.values({
								userId: offer.contributorId,
								requestId,
								type: 'response_declined',
								title: `Your offer was declined`,
								body: `Your offer for "${request.title}" has been declined.`,
								data: { offerId },
							})
							.onConflictDoNothing({
								target: [notifications.requestId, notifications.userId],
							});

						set.status = 200;
						return toOfferResponse(declined);
					},
					{
						params: t.Object({
							id: t.String({ format: 'uuid' }),
							offerId: t.String({ format: 'uuid' }),
						}),
					},
				),
		);
}
