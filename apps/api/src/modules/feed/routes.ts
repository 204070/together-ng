import { Elysia, t } from 'elysia';
import type { Db } from '../../infra/database';
import type { RedisService } from '../../infra/redis';
import type { AuthServices } from '../auth/services';
import { createFeedService, FeedService } from './services';

export interface FeedRouterOptions {
	redis?: RedisService;
}

export function createFeedRouter(
	services: AuthServices | { db: Db } | FeedService,
	options: FeedRouterOptions = {},
) {
	const feedService =
		services instanceof FeedService
			? services
			: 'feedService' in services && (services as { feedService?: FeedService }).feedService
				? (services as { feedService: FeedService }).feedService
				: createFeedService(services.db, options.redis);

	return new Elysia()
		.get(
			'/requests/featured',
			async ({ query }) => {
				return feedService.getFeaturedFeed(query);
			},
			{
				query: t.Object({
					sort: t.Optional(t.String()),
					categoryId: t.Optional(t.String()),
					category: t.Optional(t.String()),
					modality: t.Optional(t.String()),
					online: t.Optional(t.Union([t.String(), t.Boolean()])),
					helpType: t.Optional(t.String()),
					location: t.Optional(t.String()),
					page: t.Optional(t.String()),
					limit: t.Optional(t.String()),
				}),
			},
		)
		.get(
			'/categories/:id/requests',
			async ({ params, query }) => {
				return feedService.getCategoryFeed(params.id, query);
			},
			{
				query: t.Object({
					sort: t.Optional(t.String()),
					modality: t.Optional(t.String()),
					online: t.Optional(t.Union([t.String(), t.Boolean()])),
					helpType: t.Optional(t.String()),
					location: t.Optional(t.String()),
					page: t.Optional(t.String()),
					limit: t.Optional(t.String()),
				}),
			},
		)
		.get(
			'/requests/search',
			async ({ query }) => {
				return feedService.searchRequests(query);
			},
			{
				query: t.Object({
					q: t.String(),
					category: t.Optional(t.String()),
					categoryId: t.Optional(t.String()),
					modality: t.Optional(t.String()),
					online: t.Optional(t.Union([t.String(), t.Boolean()])),
					helpType: t.Optional(t.String()),
					location: t.Optional(t.String()),
					sort: t.Optional(t.String()),
					page: t.Optional(t.String()),
					limit: t.Optional(t.String()),
				}),
			},
		)
		.get('/categories', async () => {
			return feedService.getCategories();
		});
}
