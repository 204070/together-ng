import { categories, desc, eq, inArray, requests, sql, votes } from '@together/db';
import { Elysia } from 'elysia';
import type { AuthServices } from './auth/services';
import { toResponse } from './requests/store';

// Placeholder feed for issue #7 (SSR wiring only). Issue #10 replaces this
// with the real feed service. Public endpoint: no auth required so the web
// SSR loader can render the first paint without a user session.
export function createFeedRouter(services: AuthServices) {
	return new Elysia()
		.get('/requests/featured', async () => {
			const rows = await services.db
				.select()
				.from(requests)
				.where(eq(requests.state, 'published'))
				.orderBy(desc(requests.createdAt))
				.limit(20);

			const requestIds = rows.map((r) => r.id);
			const countMap = new Map<string, number>();

			if (requestIds.length > 0) {
				const voteCounts = await services.db
					.select({
						requestId: votes.requestId,
						count: sql<number>`count(*)::int`,
					})
					.from(votes)
					.where(inArray(votes.requestId, requestIds))
					.groupBy(votes.requestId);

				for (const v of voteCounts) {
					countMap.set(v.requestId, v.count);
				}
			}

			return {
				items: rows.map((row) => ({
					...toResponse(row),
					voteCount: countMap.get(row.id) ?? 0,
				})),
			};
		})
		.get('/categories', async () => {
			const rows = await services.db.select().from(categories).orderBy(categories.name);

			return {
				items: rows.map((r) => ({
					id: r.id,
					name: r.name,
					slug: r.slug,
					description: r.description,
					parentId: r.parentId,
					retiredAt: r.retiredAt ? r.retiredAt.toISOString() : null,
					createdAt: r.createdAt.toISOString(),
					updatedAt: r.updatedAt.toISOString(),
				})),
			};
		});
}
