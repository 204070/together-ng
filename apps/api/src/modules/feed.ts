import { and, asc, categories, desc, eq, inArray, isNull, or, requests, sql } from '@together/db';
import { Elysia, t } from 'elysia';
import { createRedisService, MockRedisService, type RedisService } from '../lib/redis';
import type { AuthServices } from './auth/services';
import { toResponse } from './requests/store';

export interface FeedRouterOptions {
	redis?: RedisService;
}

let defaultRedis: RedisService | null = null;

export function getFeedRedis(): RedisService {
	if (!defaultRedis) {
		if (process.env.NODE_ENV === 'test') {
			defaultRedis = new MockRedisService();
		} else {
			defaultRedis = createRedisService();
		}
	}
	return defaultRedis;
}

export function setFeedRedis(service: RedisService | null): void {
	defaultRedis = service;
}

export const FEATURED_CACHE_TTL_SECONDS = 30;

const PUBLIC_STATES = ['published', 'receiving_responses', 'help_arranged', 'in_progress'];
const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePagination(query: Record<string, unknown>) {
	let page = Number(query.page) || 1;
	let limit = Number(query.limit) || PAGE_SIZE;
	if (page < 1) page = 1;
	if (limit < 1) limit = PAGE_SIZE;
	if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
	return { page, limit, offset: (page - 1) * limit };
}

function buildFeedConditions(filters: {
	categoryId?: number | null;
	modality?: string;
	helpType?: string;
	location?: string;
}) {
	const conditions = [inArray(requests.state, PUBLIC_STATES), isNull(requests.closedAt)];

	if (filters.categoryId) {
		conditions.push(eq(requests.categoryId, filters.categoryId));
	}
	if (filters.modality) {
		conditions.push(eq(requests.modality, filters.modality as 'online' | 'in_person' | 'both'));
	}
	if (filters.helpType) {
		conditions.push(
			eq(
				requests.helpType,
				filters.helpType as 'borrow' | 'receive' | 'access' | 'learn' | 'collaborate',
			),
		);
	}
	if (filters.location) {
		conditions.push(sql`lower(${requests.location}) like ${`%${filters.location.toLowerCase()}%`}`);
	}

	return conditions;
}

export function createFeedRouter(services: AuthServices, options: FeedRouterOptions = {}) {
	return new Elysia()
		.get(
			'/requests/featured',
			async ({ query }) => {
				const redis = options.redis ?? getFeedRedis();
				const { page, limit, offset } = parsePagination(query);
				const sort = (query.sort as string) || 'most_supported';
				const conditions = buildFeedConditions({
					categoryId: query.categoryId ? Number(query.categoryId) : undefined,
					modality: query.modality as string | undefined,
					helpType: query.helpType as string | undefined,
					location: query.location as string | undefined,
				});

				const cacheKey = `feed:featured:${sort}:${page}:${limit}:${query.categoryId ?? ''}:${query.modality ?? ''}:${query.helpType ?? ''}:${query.location ?? ''}`;
				const cached = await redis.get(cacheKey);
				if (cached) {
					try {
						return JSON.parse(cached);
					} catch {
						// corrupted cache fallback
					}
				}

				const orderExpr =
					sort === 'still_open'
						? asc(requests.publishedAt)
						: sort === 'newest'
							? sql`${desc(requests.createdAt)}, ${desc(requests.id)}`
							: sql`${desc(requests.voteCount)}, ${desc(requests.createdAt)}, ${desc(requests.id)}`;

				const rows = await services.db
					.select()
					.from(requests)
					.where(and(...conditions))
					.orderBy(orderExpr)
					.limit(limit)
					.offset(offset);

				const items = rows.map((row) => ({
					...toResponse(row),
					voteCount: row.voteCount,
				}));

				const [{ count }] = await services.db
					.select({ count: sql<number>`count(*)::int` })
					.from(requests)
					.where(and(...conditions));

				const response = {
					items,
					pagination: {
						page,
						limit,
						total: count,
						totalPages: Math.ceil(count / limit),
					},
				};

				try {
					await redis.set(cacheKey, JSON.stringify(response), { ex: FEATURED_CACHE_TTL_SECONDS });
				} catch {
					// ignore redis write failure
				}

				return response;
			},
			{
				query: t.Object({
					sort: t.Optional(t.String()),
					categoryId: t.Optional(t.String()),
					modality: t.Optional(t.String()),
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
				const { page, limit, offset } = parsePagination(query);
				const sort = (query.sort as string) || 'newest';
				const slug = params.id;

				const [category] = await services.db
					.select()
					.from(categories)
					.where(eq(categories.slug, slug))
					.limit(1);

				if (!category) {
					return {
						error: 'CATEGORY_NOT_FOUND',
						items: [],
						pagination: { page, limit, total: 0, totalPages: 0 },
					};
				}

				if (category.retiredAt) {
					return {
						error: 'CATEGORY_RETIRED',
						items: [],
						pagination: { page, limit, total: 0, totalPages: 0 },
					};
				}

				const conditions = buildFeedConditions({
					categoryId: category.id,
					modality: query.modality as string | undefined,
					helpType: query.helpType as string | undefined,
					location: query.location as string | undefined,
				});

				const orderExpr =
					sort === 'most_supported'
						? sql`${desc(requests.voteCount)}, ${desc(requests.createdAt)}, ${desc(requests.id)}`
						: sort === 'still_open'
							? asc(requests.publishedAt)
							: sql`${desc(requests.createdAt)}, ${desc(requests.id)}`;

				const rows = await services.db
					.select()
					.from(requests)
					.where(and(...conditions))
					.orderBy(orderExpr)
					.limit(limit)
					.offset(offset);

				const items = rows.map((row) => ({
					...toResponse(row),
					voteCount: row.voteCount,
				}));

				const [{ count }] = await services.db
					.select({ count: sql<number>`count(*)::int` })
					.from(requests)
					.where(and(...conditions));

				return {
					category: {
						id: category.id,
						name: category.name,
						slug: category.slug,
						description: category.description,
					},
					items,
					pagination: {
						page,
						limit,
						total: count,
						totalPages: Math.ceil(count / limit),
					},
				};
			},
			{
				query: t.Object({
					sort: t.Optional(t.String()),
					modality: t.Optional(t.String()),
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
				const { page, limit, offset } = parsePagination(query);
				const q = (query.q as string) || '';
				const sort = (query.sort as string) || 'relevance';

				if (!q.trim()) {
					return {
						items: [],
						query: q,
						pagination: { page, limit, total: 0, totalPages: 0 },
					};
				}

				const searchQuery = sql`${q}::text`;
				const tsQuery = sql`plainto_tsquery('simple', ${searchQuery})`;

				const tsvectorMatch = sql`${requests.searchVector} @@ ${tsQuery}`;
				const trigramMatch = sql`${requests.title} % ${searchQuery}`;
				const searchCondition = or(tsvectorMatch, trigramMatch);

				const conditions = [inArray(requests.state, PUBLIC_STATES), isNull(requests.closedAt)];

				if (searchCondition) {
					conditions.push(searchCondition);
				}

				if (query.category) {
					const catSlug = query.category as string;
					const [cat] = await services.db
						.select({ id: categories.id })
						.from(categories)
						.where(eq(categories.slug, catSlug))
						.limit(1);
					if (cat) {
						conditions.push(eq(requests.categoryId, cat.id));
					} else {
						return {
							items: [],
							query: q,
							pagination: { page, limit, total: 0, totalPages: 0 },
						};
					}
				}
				if (query.modality) {
					conditions.push(eq(requests.modality, query.modality as 'online' | 'in_person' | 'both'));
				}
				if (query.helpType) {
					conditions.push(
						eq(
							requests.helpType,
							query.helpType as 'borrow' | 'receive' | 'access' | 'learn' | 'collaborate',
						),
					);
				}
				if (query.location) {
					conditions.push(
						sql`lower(${requests.location}) like ${`%${(query.location as string).toLowerCase()}%`}`,
					);
				}

				const relevanceExpr = sql<number>`ts_rank(${requests.searchVector}, ${tsQuery})`;

				const orderExpr =
					sort === 'newest'
						? sql`${desc(requests.createdAt)}, ${desc(requests.id)}`
						: sort === 'most_supported'
							? sql`${desc(requests.voteCount)}, ${desc(requests.createdAt)}, ${desc(requests.id)}`
							: sort === 'still_open'
								? asc(requests.publishedAt)
								: desc(relevanceExpr);

				const rows = await services.db
					.select({
						request: requests,
						relevance: relevanceExpr,
					})
					.from(requests)
					.where(and(...conditions))
					.orderBy(orderExpr)
					.limit(limit)
					.offset(offset);

				const items = rows.map((row) => ({
					...toResponse(row.request),
					voteCount: row.request.voteCount,
					relevance: row.relevance,
				}));

				const [{ count }] = await services.db
					.select({ count: sql<number>`count(*)::int` })
					.from(requests)
					.where(and(...conditions));

				return {
					items,
					query: q,
					pagination: {
						page,
						limit,
						total: count,
						totalPages: Math.ceil(count / limit),
					},
				};
			},
			{
				query: t.Object({
					q: t.String(),
					category: t.Optional(t.String()),
					modality: t.Optional(t.String()),
					helpType: t.Optional(t.String()),
					location: t.Optional(t.String()),
					sort: t.Optional(t.String()),
					page: t.Optional(t.String()),
					limit: t.Optional(t.String()),
				}),
			},
		)
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
