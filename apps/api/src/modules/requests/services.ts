import type {
	OfferAction,
	OfferCreate,
	RequestDraftCreate,
	RequestPatch,
	Static,
} from '@together/schemas';
import type { NewNotification } from '../../infra/database';
import { HttpError } from '../../lib/errors';
import type { RateLimitDecision } from '../../lib/rate-limit';
import { publishVoteUpdate } from '../../lib/vote-ws';
import type { MatchingService } from '../../worker/matching';
import type { NotificationService } from '../notifications/services';
import { missingFields, qualityHints } from './quality';
import { computeChangeRatio } from './similarity';
import { canTransition } from './state';
import { type RequestStore, toOfferResponse, toResponse } from './store';

export const REQUEST_WINDOW_MS = 60_000;
export const REQUEST_MAX_HITS = 20;

export const EDITABLE_STATES = new Set(['published', 'receiving_responses']);
export const OFFERABLE_STATES = new Set(['published', 'receiving_responses']);

function notFound(message = 'Request not found'): HttpError {
	return new HttpError(404, 'NOT_FOUND', undefined, undefined, message);
}

function notOwner(): HttpError {
	return new HttpError(403, 'NOT_REQUEST_OWNER', undefined, undefined, 'Not the request owner');
}

function invalidStateTransition(message = 'Cannot transition to this state'): HttpError {
	return new HttpError(409, 'INVALID_STATE_TRANSITION', undefined, undefined, message);
}

function cannotEditInState(state: string): HttpError {
	return new HttpError(
		422,
		'CANNOT_EDIT',
		{ state },
		undefined,
		'Request cannot be edited in this state',
	);
}

function categoryNotFound(): HttpError {
	return new HttpError(
		422,
		'CATEGORY_NOT_FOUND',
		{ categoryId: 'not_found' },
		undefined,
		'Category not found',
	);
}

function categoryRetired(): HttpError {
	return new HttpError(
		422,
		'CATEGORY_RETIRED',
		{ categoryId: 'retired' },
		undefined,
		'Category is retired',
	);
}

function cannotVoteOnOwnRequest(): HttpError {
	return new HttpError(
		403,
		'CANNOT_VOTE_OWN_REQUEST',
		undefined,
		undefined,
		'Cannot vote on own request',
	);
}

const VOTEABLE_STATES = new Set([
	'published',
	'receiving_responses',
	'help_arranged',
	'in_progress',
	'completed',
]);

function votingNotAllowedInState(state: string): HttpError {
	return new HttpError(
		422,
		'VOTING_NOT_ALLOWED',
		{ state },
		undefined,
		'Voting not allowed in this state',
	);
}

function duplicateVote(): HttpError {
	return new HttpError(409, 'ALREADY_VOTED', undefined, undefined, 'Already voted');
}

function voteNotFound(): HttpError {
	return new HttpError(404, 'VOTE_NOT_FOUND', undefined, undefined, 'Vote not found');
}

function cannotOfferOnOwnRequest(): HttpError {
	return new HttpError(
		403,
		'CANNOT_OFFER_OWN_REQUEST',
		undefined,
		undefined,
		'Cannot offer to help on your own request',
	);
}

function offerNotAllowedInState(state: string): HttpError {
	return new HttpError(
		422,
		'OFFER_NOT_ALLOWED',
		{ state },
		undefined,
		'Offers are not allowed for this request state',
	);
}

function duplicateOffer(): HttpError {
	return new HttpError(
		409,
		'ALREADY_OFFERED',
		undefined,
		undefined,
		'You have already submitted an offer for this request',
	);
}

function offerNotFound(): HttpError {
	return new HttpError(404, 'OFFER_NOT_FOUND', undefined, undefined, 'Offer not found');
}

function notRequestOwner(): HttpError {
	return new HttpError(403, 'NOT_REQUEST_OWNER', undefined, undefined, 'Not the request owner');
}

function invalidOfferStatus(currentStatus: string): HttpError {
	return new HttpError(
		422,
		'INVALID_OFFER_STATUS',
		{ currentStatus },
		undefined,
		'Offer cannot be transitioned from its current status',
	);
}

export interface AsyncRateLimiter {
	check(key: string): RateLimitDecision | Promise<RateLimitDecision>;
}

export class RequestService {
	constructor(
		public readonly store: RequestStore,
		public readonly limiter: AsyncRateLimiter,
		public readonly matching: MatchingService,
		public readonly notifications: NotificationService,
	) {}

	private async checkRateLimit(key: string) {
		const decision = await this.limiter.check(key);
		if (!decision.allowed) {
			throw new HttpError(
				429,
				'RATE_LIMITED',
				undefined,
				decision.retryAfterSeconds,
				'Rate limit exceeded. Please try again later.',
			);
		}
	}

	private async sendNotification(entry: {
		userId: string;
		requestId: string;
		type: NewNotification['type'];
		title: string;
		body: string;
		data?: Record<string, unknown>;
	}) {
		await this.notifications.send({
			userId: entry.userId,
			requestId: entry.requestId,
			type: entry.type,
			title: entry.title,
			body: entry.body,
			data: entry.data,
		});
	}

	async createDraft(authorId: string, b: Static<typeof RequestDraftCreate>) {
		await this.checkRateLimit(`create:${authorId}`);

		if (b.categoryId !== undefined) {
			const cat = await this.store.findCategoryById(b.categoryId);
			if (!cat) throw categoryNotFound();
			if (cat.retiredAt !== null) throw categoryRetired();
		}

		const row = await this.store.createRequest(authorId, b as Record<string, unknown>);
		const base = toResponse(row);
		const hints = qualityHints(b as never);
		return { ...base, qualityHints: hints };
	}

	async patchRequest(requestId: string, actorUserId: string, b: Static<typeof RequestPatch>) {
		const row = await this.store.findRequestById(requestId);
		if (!row) throw notFound();
		if (row.authorId !== actorUserId) throw notOwner();

		const isDraft = row.state === 'draft';
		const isEditable = isDraft || EDITABLE_STATES.has(row.state);
		if (!isEditable) {
			throw cannotEditInState(row.state);
		}

		if (b.categoryId !== undefined) {
			const cat = await this.store.findCategoryById(b.categoryId);
			if (!cat) throw categoryNotFound();
			if (cat.retiredAt !== null) throw categoryRetired();
		}

		const updated = await this.store.updateRequest(requestId, b as Record<string, unknown>);
		if (!updated) throw notFound();

		if (updated.state === 'published') {
			this.matching.recompute(requestId).catch(() => {});
		}

		if (!isDraft && EDITABLE_STATES.has(row.state)) {
			const changeRatio = computeChangeRatio(row, b as Record<string, unknown>);
			if (changeRatio >= 0.5) {
				const responderIds = await this.store.listRespondersForRequest(requestId);
				for (const responderId of responderIds) {
					if (responderId !== actorUserId) {
						await this.notifications.send({
							userId: responderId,
							requestId,
							type: 'request_update',
							title: 'Request updated',
							body: `The request "${updated.title}" has been significantly updated. Please review the changes.`,
							data: { changeRatio },
						});
					}
				}
			}
		}

		const base = toResponse(updated);
		const hints = qualityHints({
			title: updated.title,
			goal: updated.goal,
			barrier: updated.barrier,
			helpNeeded: updated.helpNeeded,
		} as never);
		return { ...base, qualityHints: hints };
	}

	async previewRequest(requestId: string, actorUserId: string) {
		const row = await this.store.findRequestById(requestId);
		if (!row) throw notFound();
		if (row.authorId !== actorUserId) throw notOwner();

		const missing = missingFields({
			title: row.title,
			goal: row.goal,
			barrier: row.barrier,
			helpNeeded: row.helpNeeded,
			categoryId: row.categoryId,
		});

		const hints = qualityHints({
			title: row.title,
			goal: row.goal,
			barrier: row.barrier,
			helpNeeded: row.helpNeeded,
		} as never);

		return {
			...toResponse(row),
			isPublishable: missing.length === 0,
			missingFields: missing,
			qualityHints: hints,
		};
	}

	async publishRequest(requestId: string, actorUserId: string) {
		const row = await this.store.findRequestById(requestId);
		if (!row || row.authorId !== actorUserId) throw notFound();

		if (!canTransition(row.state, 'published')) {
			throw invalidStateTransition(`Cannot publish request in '${row.state}' state`);
		}

		if (row.categoryId === null) {
			throw new HttpError(
				422,
				'VALIDATION',
				{ categoryId: 'required' },
				undefined,
				'Missing required fields',
			);
		}

		const cat = await this.store.findCategoryById(row.categoryId);
		if (!cat) throw categoryNotFound();
		if (cat.retiredAt !== null) throw categoryRetired();

		const fields: Record<string, string> = {};
		if (!row.title || row.title.trim() === '' || row.title.length > 200) {
			fields.title = 'required';
		}
		if (!row.goal || row.goal.trim() === '' || row.goal.length > 2000) {
			fields.goal = 'required';
		}
		if (!row.barrier || row.barrier.trim() === '' || row.barrier.length > 2000) {
			fields.barrier = 'required';
		}
		if (!row.helpNeeded || row.helpNeeded.trim() === '' || row.helpNeeded.length > 2000) {
			fields.helpNeeded = 'required';
		}
		if (Object.keys(fields).length > 0) {
			throw new HttpError(422, 'VALIDATION', fields, undefined, 'Missing required fields');
		}

		const published = await this.store.publishRequest(requestId);
		if (!published) throw notFound();

		await this.matching.recompute(requestId);

		const base = toResponse(published);
		const hints = qualityHints({
			title: published.title,
			goal: published.goal,
			barrier: published.barrier,
			helpNeeded: published.helpNeeded,
		} as never);
		return { ...base, qualityHints: hints };
	}

	async closeRequest(requestId: string, actorUserId: string, body?: { reason?: string } | null) {
		const row = await this.store.findRequestById(requestId);
		if (!row) throw notFound();
		if (row.authorId !== actorUserId) throw notOwner();

		if (!canTransition(row.state, 'closed')) {
			throw invalidStateTransition(`Cannot close request in '${row.state}' state`);
		}

		const reason = body?.reason?.trim() || undefined;
		const closed = await this.store.closeRequest(requestId, reason);
		if (!closed) throw notFound();

		const responderIds = await this.store.listRespondersForRequest(requestId);
		for (const responderId of responderIds) {
			if (responderId !== actorUserId) {
				await this.notifications.send({
					userId: responderId,
					requestId,
					type: 'request_closed',
					title: 'Request closed',
					body: `The request "${closed.title}" has been closed.`,
					data: { reason: reason ?? null },
				});
			}
		}

		return toResponse(closed);
	}

	async cancelRequest(requestId: string, actorUserId: string) {
		const row = await this.store.findRequestById(requestId);
		if (!row) throw notFound();
		if (row.authorId !== actorUserId) throw notOwner();

		if (!canTransition(row.state, 'cancelled')) {
			throw invalidStateTransition(`Cannot cancel request in '${row.state}' state`);
		}

		const cancelled = await this.store.cancelRequest(requestId);
		if (!cancelled) throw notFound();

		const responderIds = await this.store.listRespondersForRequest(requestId);
		for (const responderId of responderIds) {
			if (responderId !== actorUserId) {
				await this.notifications.send({
					userId: responderId,
					requestId,
					type: 'request_cancelled',
					title: 'Request cancelled',
					body: `The request "${cancelled.title}" has been cancelled.`,
				});
			}
		}

		return toResponse(cancelled);
	}

	async archiveRequest(requestId: string, actorUserId: string) {
		const row = await this.store.findRequestById(requestId);
		if (!row) throw notFound();
		if (row.authorId !== actorUserId) throw notOwner();

		if (!canTransition(row.state, 'archived')) {
			throw invalidStateTransition(`Cannot archive request in '${row.state}' state`);
		}

		const archived = await this.store.archiveRequest(requestId);
		if (!archived) throw notFound();
		return toResponse(archived);
	}

	async getRequest(requestId: string, actorUserId?: string) {
		const row = await this.store.findRequestById(requestId);
		if (!row) throw notFound();

		const isOwner = Boolean(actorUserId) && row.authorId === actorUserId;
		if (row.state === 'draft' && !isOwner) throw notFound();

		const base = toResponse(row);
		const hints = isOwner
			? qualityHints({
					title: row.title,
					goal: row.goal,
					barrier: row.barrier,
					helpNeeded: row.helpNeeded,
				} as never)
			: undefined;

		const voteCount = await this.store.countVotes(requestId);
		const existingVote = actorUserId
			? await this.store.findVote(actorUserId, requestId)
			: undefined;

		return {
			...base,
			voteCount,
			hasVoted: Boolean(existingVote),
			...(hints ? { qualityHints: hints } : {}),
		};
	}

	async getOffers(requestId: string, actorUserId?: string) {
		const request = await this.store.findRequestById(requestId);
		if (!request) throw notFound();

		const isOwner = Boolean(actorUserId) && request.authorId === actorUserId;

		if (isOwner) {
			const offers = await this.store.listOffersForRequest(requestId);
			return {
				offers: offers.map((o) => toOfferResponse(o)),
				total: offers.length,
			};
		}

		if (actorUserId) {
			const myOffers = await this.store.listOffersByContributor(actorUserId);
			const requestOffers = myOffers.filter((o) => o.requestId === requestId);
			if (requestOffers.length > 0) {
				return {
					offers: requestOffers.map((o) => toOfferResponse(o)),
					total: requestOffers.length,
				};
			}
		}

		const count = await this.store.countOffersForRequest(requestId);
		return { offers: [], total: count };
	}

	async createOffer(requestId: string, userId: string, b: Static<typeof OfferCreate>) {
		await this.checkRateLimit(`offer:${userId}`);
		const request = await this.store.findRequestById(requestId);
		if (!request) throw notFound();
		if (request.authorId === userId) throw cannotOfferOnOwnRequest();
		if (!OFFERABLE_STATES.has(request.state)) {
			throw offerNotAllowedInState(request.state);
		}

		const existing = await this.store.findOfferByContributor(requestId, userId);
		if (existing) throw duplicateOffer();

		const offer = await this.store.createOffer(requestId, userId, {
			message: b.message,
			anonymous: b.anonymous,
			modality: b.modality,
		});

		return toOfferResponse(offer);
	}

	async acceptOffer(
		requestId: string,
		offerId: string,
		userId: string,
		_input?: Static<typeof OfferAction> | null,
	) {
		const request = await this.store.findRequestById(requestId);
		if (!request) throw notFound();
		if (request.authorId !== userId) throw notRequestOwner();

		const offer = await this.store.findOfferById(offerId);
		if (!offer || offer.requestId !== requestId) throw offerNotFound();
		if (offer.status !== 'pending') throw invalidOfferStatus(offer.status);

		const accepted = await this.store.updateOfferStatus(offerId, 'accepted');
		if (!accepted) throw offerNotFound();

		if (canTransition(request.state, 'help_arranged')) {
			await this.store.updateRequest(requestId, { state: 'help_arranged' });
		}

		await this.sendNotification({
			userId: offer.contributorId,
			requestId,
			type: 'response_accepted',
			title: 'Your offer was accepted',
			body: `Your offer for "${request.title}" has been accepted.`,
			data: { offerId },
		});

		return toOfferResponse(accepted);
	}

	async declineOffer(
		requestId: string,
		offerId: string,
		userId: string,
		_input?: Static<typeof OfferAction> | null,
	) {
		const request = await this.store.findRequestById(requestId);
		if (!request) throw notFound();
		if (request.authorId !== userId) throw notRequestOwner();

		const offer = await this.store.findOfferById(offerId);
		if (!offer || offer.requestId !== requestId) throw offerNotFound();
		if (offer.status !== 'pending') throw invalidOfferStatus(offer.status);

		const declined = await this.store.updateOfferStatus(offerId, 'declined');
		if (!declined) throw offerNotFound();

		await this.sendNotification({
			userId: offer.contributorId,
			requestId,
			type: 'response_declined',
			title: 'Your offer was declined',
			body: `Your offer for "${request.title}" has been declined.`,
			data: { offerId },
		});

		return toOfferResponse(declined);
	}

	async vote(requestId: string, userId: string) {
		await this.checkRateLimit(`vote:${userId}`);
		const row = await this.store.findRequestById(requestId);
		if (!row) throw notFound();

		if (row.authorId === userId) throw cannotVoteOnOwnRequest();

		if (!VOTEABLE_STATES.has(row.state)) {
			throw votingNotAllowedInState(row.state);
		}

		const existing = await this.store.findVote(userId, requestId);
		if (existing) throw duplicateVote();

		const inserted = await this.store.addVote(userId, requestId);
		if (!inserted) throw duplicateVote();

		const voteCount = await this.store.countVotes(requestId);
		await publishVoteUpdate(requestId, voteCount);
		return { voteCount, hasVoted: true };
	}

	async removeVote(requestId: string, userId: string) {
		await this.checkRateLimit(`vote:${userId}`);
		const row = await this.store.findRequestById(requestId);
		if (!row) throw notFound();

		const existing = await this.store.findVote(userId, requestId);
		if (!existing) throw voteNotFound();

		const removed = await this.store.removeVote(userId, requestId);
		if (!removed) throw voteNotFound();

		const voteCount = await this.store.countVotes(requestId);
		await publishVoteUpdate(requestId, voteCount);
		return { voteCount, hasVoted: false };
	}
}

export interface RequestServiceDeps {
	store: RequestStore;
	limiter: AsyncRateLimiter;
	matching: MatchingService;
	notifications: NotificationService;
}

export function createRequestService(deps: RequestServiceDeps): RequestService {
	return new RequestService(deps.store, deps.limiter, deps.matching, deps.notifications);
}

export const createRequestServices = createRequestService;
