import { jwt } from '@elysiajs/jwt';
import { RequestDraftCreate, RequestPatch, Value } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { HttpError } from '../../auth/errors';
import type { AuthServices } from '../../auth/services';
import { FixedWindowRateLimiter } from '../../lib/rate-limit';
import { missingFields, qualityHints } from './quality';
import { canTransition } from './state';
import { RequestStore, toResponse } from './store';

function unauthorized(): HttpError {
	return new HttpError(401, 'UNAUTHORIZED', undefined, undefined, 'Authentication required');
}
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
function extractBearer(auth: string | undefined): string | undefined {
	if (!auth) return undefined;
	const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
	return m?.[1];
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
export function createRequestRouter(services: AuthServices) {
	const store = new RequestStore(services.sql);
	const limiter = new FixedWindowRateLimiter(60_000, 20, { now: () => services.now().getTime() });
	async function requireUser(
		headers: Record<string, string | undefined>,
		jwtVerify: { verify: (tok: string) => Promise<unknown> },
	): Promise<string> {
		const token = extractBearer(headers.authorization);
		if (!token) throw unauthorized();
		const payload = await jwtVerify.verify(token);
		if (!payload || typeof (payload as Record<string, unknown>).sub !== 'string')
			throw unauthorized();
		const sub = (payload as Record<string, unknown>).sub as string;
		const user = await services.store.findUserById(sub);
		if (user?.status !== 'active' || user.deleted_at !== null) throw unauthorized();
		return sub;
	}
	return new Elysia()
		.use(jwt({ name: 'jwt', secret: services.jwtSecret, exp: '15m' }))
		.post('/requests', async ({ body, headers, jwt: j, set }) => {
			const userId = await requireUser(
				headers as Record<string, string | undefined>,
				j as unknown as { verify: (tok: string) => Promise<unknown> },
			);
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
			async ({ params, headers, jwt: j }) => {
				const userId = await requireUser(
					headers as Record<string, string | undefined>,
					j as unknown as { verify: (tok: string) => Promise<unknown> },
				);
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
			async ({ params, body, headers, jwt: j }) => {
				const userId = await requireUser(
					headers as Record<string, string | undefined>,
					j as unknown as { verify: (tok: string) => Promise<unknown> },
				);
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
			async ({ params, headers, jwt: j }) => {
				const userId = await requireUser(
					headers as Record<string, string | undefined>,
					j as unknown as { verify: (tok: string) => Promise<unknown> },
				);
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
			async ({ params, headers, jwt: j }) => {
				const userId = await requireUser(
					headers as Record<string, string | undefined>,
					j as unknown as { verify: (tok: string) => Promise<unknown> },
				);
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
