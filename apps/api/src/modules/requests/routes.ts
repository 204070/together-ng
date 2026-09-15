import { jwt } from '@elysiajs/jwt';
import { RequestDraftCreate, RequestPatch, Value } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { createAuthGuard, type JwtVerifier, requireActiveActor } from '../../lib/authentication';
import { HttpError } from '../../lib/errors';
import { missingFields, qualityHints } from './quality';
import type { RequestServices } from './services';
import { canTransition } from './state';
import { toResponse } from './store';

function notFound(): HttpError {
	return new HttpError(404, 'NOT_FOUND', undefined, undefined, 'Request not found');
}
function invalidState(): HttpError {
	return new HttpError(
		409,
		'INVALID_STATE_TRANSITION',
		undefined,
		undefined,
		'Invalid state transition',
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
export function createRequestRouter(services: RequestServices) {
	const store = services.store;
	const limiter = services.limiter;
	// Background matching recompute runs asynchronously through the Postgres-backed queue.
	// Publish returns immediately once the request state changes; matching failure never
	// fails the publish itself and is logged.
	const triggerMatching = (requestId: string): void => {
		if (!services.matching) return;
		services.matching.recompute(requestId).catch((error) => {
			console.error(`matching recompute failed for request ${requestId}`, error);
		});
	};
	return new Elysia()
		.use(jwt({ name: 'jwt', secret: services.jwtSecret, exp: '15m' }))
		.get(
			'/requests/:id',
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
				const row = await store.findRequestById(params.id);
				if (!row) throw notFound();
				// Draft requests are private to author; published/public requests are visible to all
				if (row.state === 'draft') {
					if (!actorUserId || row.authorId !== actorUserId) throw notFound();
				}
				const base = toResponse(row);
				const isAuthor = actorUserId && row.authorId === actorUserId;
				const hints = isAuthor
					? qualityHints({
							title: row.title,
							goal: row.goal,
							barrier: row.barrier,
							helpNeeded: row.helpNeeded,
						} as never)
					: undefined;

				const voteCount = await store.countVotes(params.id);
				const existingVote = actorUserId ? await store.findVote(actorUserId, params.id) : undefined;

				return {
					...base,
					voteCount,
					hasVoted: !!existingVote,
					...(hints ? { qualityHints: hints } : {}),
				};
			},
			{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
		)
		.use(
			new Elysia()
				.use(createAuthGuard({ findUserById: services.findUserById }, services.jwtSecret))
				.post('/requests', async ({ body, actor, set }) => {
					const userId = actor.userId;
					const lim = await limiter.check(`req:${userId}`);
					if (!lim.allowed)
						throw new HttpError(
							429,
							'RATE_LIMITED',
							undefined,
							lim.retryAfterSeconds,
							'Too many requests',
						);
					const b = (body ?? {}) as Record<string, unknown>;
					if (!Value.Check(RequestDraftCreate, b)) {
						const issues = collectIssues(RequestDraftCreate, b);
						throw new HttpError(422, 'VALIDATION', issues, undefined, 'Invalid request');
					}
					if (b.categoryId !== undefined) {
						const cat = await store.findCategoryById(b.categoryId as number);
						if (!cat) throw categoryNotFound();
						if (cat.retiredAt !== null) throw categoryRetired();
					}
					const row = await store.createRequest(userId, b);
					const base = toResponse(row);
					const hints = qualityHints(b as never);
					set.status = 201;
					return { ...base, qualityHints: hints };
				})
				.patch(
					'/requests/:id',
					async ({ params, body, actor }) => {
						const userId = actor.userId;
						const lim = await limiter.check(`req:${userId}`);
						if (!lim.allowed)
							throw new HttpError(
								429,
								'RATE_LIMITED',
								undefined,
								lim.retryAfterSeconds,
								'Too many requests',
							);
					const row = await store.findRequestById(params.id);
					if (!row || row.authorId !== userId) throw notFound();
					if (row.state !== 'draft') throw invalidState();
					const b = (body ?? {}) as Record<string, unknown>;
					if (!Value.Check(RequestPatch, b)) {
						const issues = collectIssues(RequestPatch, b);
						throw new HttpError(422, 'VALIDATION', issues, undefined, 'Invalid request');
					}
					if (b.categoryId !== undefined) {
						const cat = await store.findCategoryById(b.categoryId as number);
						if (!cat) throw categoryNotFound();
						if (cat.retiredAt !== null) throw categoryRetired();
					}
						const updated = await store.updateRequest(params.id, b);
						if (!updated) throw notFound();
						// Recompute only for edits of published requests; draft edits skip
						// matching entirely (unreachable today: PATCH rejects non-drafts,
						// but the hook stays correct if a published-edit route appears).
						if (updated.state === 'published') triggerMatching(params.id);
						const base = toResponse(updated);
						const hints = qualityHints({
							title: updated.title,
							goal: updated.goal,
							barrier: updated.barrier,
							helpNeeded: updated.helpNeeded,
						} as never);
						return { ...base, qualityHints: hints };
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				)
				.get(
					'/requests/:id/preview',
					async ({ params, actor }) => {
						const userId = actor.userId;
					const row = await store.findRequestById(params.id);
					if (!row || row.authorId !== userId) throw notFound();
					const base = toResponse(row);
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
						return { request: base, missingFields: missing, qualityHints: hints };
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				)
				.post(
					'/requests/:id/publish',
					async ({ params, actor }) => {
						const userId = actor.userId;
					const row = await store.findRequestById(params.id);
					if (!row || row.authorId !== userId) throw notFound();
					if (!canTransition(row.state, 'published')) throw invalidState();
					if (row.categoryId === null)
						throw new HttpError(
							422,
							'VALIDATION',
							{ categoryId: 'required' },
							undefined,
							'Missing required fields',
						);
					const cat = await store.findCategoryById(row.categoryId);
					if (!cat) throw categoryNotFound();
					if (cat.retiredAt !== null) throw categoryRetired();
					const fields: Record<string, string> = {};
					if (!row.title || row.title.trim() === '' || row.title.length > 200)
						fields.title = 'required';
					if (!row.goal || row.goal.trim() === '' || row.goal.length > 2000)
						fields.goal = 'required';
					if (!row.barrier || row.barrier.trim() === '' || row.barrier.length > 2000)
						fields.barrier = 'required';
					if (!row.helpNeeded || row.helpNeeded.trim() === '' || row.helpNeeded.length > 2000)
						fields.helpNeeded = 'required';
						if (Object.keys(fields).length > 0)
							throw new HttpError(422, 'VALIDATION', fields, undefined, 'Missing required fields');
						const published = await store.publishRequest(params.id);
						if (!published) throw notFound();
						triggerMatching(params.id);
						const base = toResponse(published);
						const hints = qualityHints({
							title: published.title,
							goal: published.goal,
							barrier: published.barrier,
							helpNeeded: published.helpNeeded,
						} as never);
						return { ...base, qualityHints: hints };
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				),
		);
}
