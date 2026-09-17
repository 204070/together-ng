import {
	and,
	asc,
	categories,
	desc,
	eq,
	inArray,
	isNull,
	or,
	requests,
	sql,
	votes,
} from '@together/db';
import { Elysia, t } from 'elysia';
import type { AuthServices } from './auth/services';
import { toResponse } from './requests/store';

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

async function getVoteCounts(
	db: AuthServices['db'],
	requestIds: string[],
): Promise<Map<string, number>> {
	const countMap = new Map<string, number>();
	if (requestIds.length === 0) return countMap;

	const voteCounts = await db
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
	return countMap;
}

const voteCountSubquerySql = sql`(select count(*) from ${votes} where ${votes.requestId} = ${requests.id})`;

export function createFeedRouter(services: AuthServices) {
	return new Elysia()
		.get(
			'/requests/featured',
			async ({ query }) => {
				const { page, limit, offset } = parsePagination(query);
				const sort = (query.sort as string) || 'newest';
				const conditions = buildFeedConditions({
					categoryId: query.categoryId ? Number(query.categoryId) : undefined,
					modality: query.modality as string | undefined,
					helpType: query.helpType as string | undefined,
					location: query.location as string | undefined,
				});

				let rows: Array<ReturnType<typeof toResponse> & { voteCount: number }>;

				const voteCountExpr = sql<number>`coalesce(${voteCountSubquerySql}, 0)`;

				if (sort === 'most_supported') {
					const voteCountSubquery = services.db
						.select({
							requestId: votes.requestId,
							count: sql<number>`count(*)::int`.as('vote_count'),
						})
						.from(votes)
						.groupBy(votes.requestId)
						.as('vc');

					const result = await services.db
						.select({
							request: requests,
							voteCount: sql<number>`coalesce(${voteCountSubquery.count}, 0)`,
						})
						.from(requests)
						.leftJoin(voteCountSubquery, eq(requests.id, voteCountSubquery.requestId))
						.where(and(...conditions))
						.orderBy(desc(sql<number>`coalesce(${voteCountSubquery.count}, 0)`))
						.limit(limit)
						.offset(offset);

					rows = result.map((row) => ({
						...toResponse(row.request),
						voteCount: row.voteCount,
					}));
				} else {
					const orderExpr =
						sort === 'still_open'
							? asc(requests.publishedAt)
							: sort === 'newest'
								? sql`${desc(requests.createdAt)}, ${desc(requests.id)}`
								: sql`${voteCountExpr} desc, ${desc(requests.createdAt)}, ${desc(requests.id)}`;

					const result = await services.db
						.select()
						.from(requests)
						.where(and(...conditions))
						.orderBy(orderExpr)
						.limit(limit)
						.offset(offset);

					const requestIds = result.map((r) => r.id);
					const countMap = await getVoteCounts(services.db, requestIds);

					rows = result.map((row) => ({
						...toResponse(row),
						voteCount: countMap.get(row.id) ?? 0,
					}));
				}

				const items = rows;

				const [{ count }] = await services.db
					.select({ count: sql<number>`count(*)::int` })
					.from(requests)
					.where(and(...conditions));

				return {
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
						? desc(
								sql<number>`coalesce((select count(*) from ${votes} where ${votes.requestId} = ${requests.id}), 0)`,
							)
						: sort === 'still_open'
							? asc(requests.publishedAt)
							: desc(requests.createdAt);

				const rows = await services.db
					.select()
					.from(requests)
					.where(and(...conditions))
					.orderBy(orderExpr)
					.limit(limit)
					.offset(offset);

				const requestIds = rows.map((r) => r.id);
				const countMap = await getVoteCounts(services.db, requestIds);

				const items = rows.map((row) => ({
					...toResponse(row),
					voteCount: countMap.get(row.id) ?? 0,
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
							? desc(
									sql<number>`coalesce((select count(*) from ${votes} where ${votes.requestId} = ${requests.id}), 0)`,
								)
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

				const requestIds = rows.map((row) => row.request.id);
				const countMap = await getVoteCounts(services.db, requestIds);

				const items = rows.map((row) => ({
					...toResponse(row.request),
					voteCount: countMap.get(row.request.id) ?? 0,
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
