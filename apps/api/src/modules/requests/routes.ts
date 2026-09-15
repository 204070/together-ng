import { RequestDraftCreate, RequestPatch, Value } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { createAuthGuard } from '../../lib/authentication';
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
	// Matching recompute runs through the Postgres-backed queue but is awaited
	// here so `request_matches` is populated by the time publish returns. A
	// matching failure never fails the publish itself; it is logged instead.
	const triggerMatching = async (requestId: string): Promise<void> => {
		if (!services.matching) return;
		try {
			await services.matching.recompute(requestId);
		} catch (error) {
			console.error(`matching recompute failed for request ${requestId}`, error);
		}
	};
	return new Elysia()
		.use(createAuthGuard({ findUserById: services.findUserById }, services.jwtSecret))
		.post('/requests', async ({ body, actor, set }) => {
			const userId = actor.userId;
			const lim = limiter.check(`req:${userId}`);
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
				if (cat.retired_at !== null) throw categoryRetired();
			}
			const row = await store.createRequest(userId, b);
			const base = toResponse(row);
			const hints = qualityHints(b as never);
			set.status = 201;
			return { ...base, qualityHints: hints };
		})
		.get(
			'/requests/:id',
			async ({ params, actor }) => {
				const userId = actor.userId;
				const row = await store.findRequestById(params.id);
				if (!row || row.author_id !== userId) throw notFound();
				const base = toResponse(row);
				const hints = qualityHints({
					title: row.title,
					goal: row.goal,
					barrier: row.barrier,
					helpNeeded: row.help_needed,
				} as never);
				return { ...base, qualityHints: hints };
			},
			{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
		)
		.patch(
			'/requests/:id',
			async ({ params, body, actor }) => {
				const userId = actor.userId;
				const lim = limiter.check(`req:${userId}`);
				if (!lim.allowed)
					throw new HttpError(
						429,
						'RATE_LIMITED',
						undefined,
						lim.retryAfterSeconds,
						'Too many requests',
					);
				const row = await store.findRequestById(params.id);
				if (!row || row.author_id !== userId) throw notFound();
				if (row.state !== 'draft') throw invalidState();
				const b = (body ?? {}) as Record<string, unknown>;
				if (!Value.Check(RequestPatch, b)) {
					const issues = collectIssues(RequestPatch, b);
					throw new HttpError(422, 'VALIDATION', issues, undefined, 'Invalid request');
				}
				if (b.categoryId !== undefined) {
					const cat = await store.findCategoryById(b.categoryId as number);
					if (!cat) throw categoryNotFound();
					if (cat.retired_at !== null) throw categoryRetired();
				}
				const updated = await store.updateRequest(params.id, b);
				if (!updated) throw notFound();
				// Recompute only for edits of published requests; draft edits skip
				// matching entirely (unreachable today: PATCH rejects non-drafts,
				// but the hook stays correct if a published-edit route appears).
				if (updated.state === 'published') await triggerMatching(params.id);
				const base = toResponse(updated);
				const hints = qualityHints({
					title: updated.title,
					goal: updated.goal,
					barrier: updated.barrier,
					helpNeeded: updated.help_needed,
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
				if (!row || row.author_id !== userId) throw notFound();
				const base = toResponse(row);
				const missing = missingFields({
					title: row.title,
					goal: row.goal,
					barrier: row.barrier,
					helpNeeded: row.help_needed,
					categoryId: row.category_id,
				});
				const hints = qualityHints({
					title: row.title,
					goal: row.goal,
					barrier: row.barrier,
					helpNeeded: row.help_needed,
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
				if (!row || row.author_id !== userId) throw notFound();
				if (!canTransition(row.state, 'published')) throw invalidState();
				if (row.category_id === null)
					throw new HttpError(
						422,
						'VALIDATION',
						{ categoryId: 'required' },
						undefined,
						'Missing required fields',
					);
				const cat = await store.findCategoryById(row.category_id);
				if (!cat) throw categoryNotFound();
				if (cat.retired_at !== null) throw categoryRetired();
				const fields: Record<string, string> = {};
				if (!row.title || row.title.trim() === '' || row.title.length > 200)
					fields.title = 'required';
				if (!row.goal || row.goal.trim() === '' || row.goal.length > 2000) fields.goal = 'required';
				if (!row.barrier || row.barrier.trim() === '' || row.barrier.length > 2000)
					fields.barrier = 'required';
				if (!row.help_needed || row.help_needed.trim() === '' || row.help_needed.length > 2000)
					fields.helpNeeded = 'required';
				if (Object.keys(fields).length > 0)
					throw new HttpError(422, 'VALIDATION', fields, undefined, 'Missing required fields');
				const published = await store.publishRequest(params.id);
				if (!published) throw notFound();
				await triggerMatching(params.id);
				const base = toResponse(published);
				const hints = qualityHints({
					title: published.title,
					goal: published.goal,
					barrier: published.barrier,
					helpNeeded: published.help_needed,
				} as never);
				return { ...base, qualityHints: hints };
			},
			{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
		);
}
