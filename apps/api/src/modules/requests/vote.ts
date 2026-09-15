import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { createAuthGuard } from '../../lib/authentication';
import { HttpError } from '../../lib/errors';
import type { RequestServices } from './services';

const VOTEABLE_STATES = new Set([
	'published',
	'receiving_responses',
	'help_arranged',
	'in_progress',
	'completed',
]);

function notFound(message = 'Request not found'): HttpError {
	return new HttpError(404, 'NOT_FOUND', undefined, undefined, message);
}

function voteNotFound(): HttpError {
	return new HttpError(404, 'VOTE_NOT_FOUND', undefined, undefined, 'Vote not found');
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

export function createVoteRouter(services: RequestServices) {
	const store = services.store;
	const limiter = services.limiter;

	return new Elysia().use(jwt({ name: 'jwt', secret: services.jwtSecret, exp: '15m' })).use(
		new Elysia()
			.use(createAuthGuard({ findUserById: services.findUserById }, services.jwtSecret))
			.post(
				'/requests/:id/vote',
				async ({ params, actor, set }) => {
					const userId = actor.userId;
					const requestId = params.id;

					const lim = await limiter.check(`vote:${userId}`);
					if (!lim.allowed)
						throw new HttpError(
							429,
							'RATE_LIMITED',
							undefined,
							lim.retryAfterSeconds,
							'Too many requests',
						);

					const row = await store.findRequestById(requestId);
					if (!row) throw notFound();

					if (row.author_id === userId) throw cannotVoteOnOwnRequest();

					if (!VOTEABLE_STATES.has(row.state)) {
						throw votingNotAllowedInState(row.state);
					}

					const existing = await store.findVote(userId, requestId);
					if (existing) throw duplicateVote();

					const inserted = await store.addVote(userId, requestId);
					if (!inserted) throw duplicateVote();

					const voteCount = await store.countVotes(requestId);
					set.status = 201;

					const result = { voteCount, hasVoted: true };
					broadcastVoteUpdate(requestId, result);
					return result;
				},
				{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
			)
			.delete(
				'/requests/:id/vote',
				async ({ params, actor, set }) => {
					const userId = actor.userId;
					const requestId = params.id;

					const lim = await limiter.check(`vote:${userId}`);
					if (!lim.allowed)
						throw new HttpError(
							429,
							'RATE_LIMITED',
							undefined,
							lim.retryAfterSeconds,
							'Too many requests',
						);

					const row = await store.findRequestById(requestId);
					if (!row) throw notFound();

					const existing = await store.findVote(userId, requestId);
					if (!existing) throw voteNotFound();

					await store.removeVote(userId, requestId);
					const voteCount = await store.countVotes(requestId);
					set.status = 200;

					const result = { voteCount, hasVoted: false };
					broadcastVoteUpdate(requestId, result);
					return result;
				},
				{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
			),
	);
}

const voteSubscribers = new Map<
	string,
	Set<(data: { voteCount: number; hasVoted: boolean }) => void>
>();

export function subscribeToVoteUpdates(
	requestId: string,
	callback: (data: { voteCount: number; hasVoted: boolean }) => void,
): () => void {
	let subs = voteSubscribers.get(requestId);
	if (!subs) {
		subs = new Set();
		voteSubscribers.set(requestId, subs);
	}
	subs.add(callback);
	return () => {
		subs?.delete(callback);
		if (subs?.size === 0) voteSubscribers.delete(requestId);
	};
}

function broadcastVoteUpdate(requestId: string, data: { voteCount: number; hasVoted: boolean }) {
	const subs = voteSubscribers.get(requestId);
	if (!subs) return;
	for (const callback of subs) {
		callback(data);
	}
}
