import {
	and,
	asc,
	categories,
	type Db,
	desc,
	eq,
	inArray,
	isNull,
	or,
	requests,
	sql,
} from '@together/db';
import { toResponse } from '../requests/store';

export { and, asc, categories, desc, eq, inArray, or, requests, toResponse };

export const PUBLIC_STATES = ['published', 'receiving_responses'] as const;
export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface FeedFilters {
	categoryId?: number | null;
	categorySlug?: string | null;
	modality?: string | null;
	online?: boolean | string | null;
	helpType?: string | null;
	location?: string | null;
}

export interface PaginationParams {
	page: number;
	limit: number;
	offset: number;
}

export function parsePagination(query: { page?: unknown; limit?: unknown }): PaginationParams {
	let page = Number(query.page) || 1;
	let limit = Number(query.limit) || PAGE_SIZE;
	if (page < 1) page = 1;
	if (limit < 1) limit = PAGE_SIZE;
	if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
	return { page, limit, offset: (page - 1) * limit };
}

export function buildFeedConditions(filters: FeedFilters) {
	const conditions = [inArray(requests.state, [...PUBLIC_STATES]), isNull(requests.closedAt)];

	if (filters.categoryId) {
		conditions.push(eq(requests.categoryId, filters.categoryId));
	}

	const onlineParam = filters.online;
	const isOnline =
		onlineParam === true ||
		onlineParam === 'true' ||
		onlineParam === '1' ||
		filters.modality === 'online';

	const isOffline =
		onlineParam === false ||
		onlineParam === 'false' ||
		onlineParam === '0' ||
		filters.modality === 'in_person';

	if (isOnline) {
		conditions.push(inArray(requests.modality, ['online', 'both']));
	} else if (isOffline) {
		conditions.push(inArray(requests.modality, ['in_person', 'both']));
	} else if (filters.modality && filters.modality !== 'all') {
		conditions.push(eq(requests.modality, filters.modality as 'online' | 'in_person' | 'both'));
	}

	if (filters.helpType && filters.helpType !== 'all') {
		conditions.push(
			eq(
				requests.helpType,
				filters.helpType as 'borrow' | 'receive' | 'access' | 'learn' | 'collaborate',
			),
		);
	}

	if (filters.location?.trim()) {
		conditions.push(
			sql`lower(${requests.location}) like ${`%${filters.location.trim().toLowerCase()}%`}`,
		);
	}

	return conditions;
}

export interface FeedItemResponse extends ReturnType<typeof toResponse> {
	voteCount: number;
	relevance?: number;
	category?: {
		id: number;
		name: string;
		slug: string;
	} | null;
}

export interface FeedResponse {
	items: FeedItemResponse[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface CategoryFeedResponse extends FeedResponse {
	category?: {
		id: number;
		name: string;
		slug: string;
		description: string | null;
	};
	error?: string;
}

export interface SearchFeedResponse extends FeedResponse {
	query: string;
}

export async function resolveCategoryId(
	db: Db,
	categoryParam?: string | number | null,
): Promise<number | null | 'NOT_FOUND'> {
	if (!categoryParam) return null;
	const asNum = Number(categoryParam);
	if (!Number.isNaN(asNum) && Number.isInteger(asNum)) {
		const [cat] = await db
			.select({ id: categories.id })
			.from(categories)
			.where(eq(categories.id, asNum))
			.limit(1);
		return cat ? cat.id : 'NOT_FOUND';
	}
	const slug = String(categoryParam).trim();
	const [cat] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(eq(categories.slug, slug))
		.limit(1);
	return cat ? cat.id : 'NOT_FOUND';
}

export async function getFeaturedRequests(
	db: Db,
	params: {
		categoryId?: number | null;
		modality?: string | null;
		online?: boolean | string | null;
		helpType?: string | null;
		location?: string | null;
		sort?: string | null;
		page: number;
		limit: number;
		offset: number;
	},
): Promise<FeedResponse> {
	const { page, limit, offset, sort = 'most_supported' } = params;
	const conditions = buildFeedConditions({
		categoryId: params.categoryId,
		modality: params.modality,
		online: params.online,
		helpType: params.helpType,
		location: params.location,
	});

	const orderExpr =
		sort === 'still_open'
			? asc(requests.publishedAt)
			: sort === 'newest'
				? sql`${desc(requests.createdAt)}, ${desc(requests.id)}`
				: sql`${desc(requests.voteCount)}, ${desc(requests.createdAt)}, ${desc(requests.id)}`;

	const rows = await db
		.select({
			request: requests,
			category: {
				id: categories.id,
				name: categories.name,
				slug: categories.slug,
			},
		})
		.from(requests)
		.leftJoin(categories, eq(requests.categoryId, categories.id))
		.where(and(...conditions))
		.orderBy(orderExpr)
		.limit(limit)
		.offset(offset);

	const items: FeedItemResponse[] = rows.map(({ request, category }) => ({
		...toResponse(request),
		voteCount: request.voteCount,
		category: category?.id ? category : null,
	}));

	const [countRow] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(requests)
		.where(and(...conditions));
	const total = countRow?.count ?? 0;

	return {
		items,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function getCategoryBySlug(db: Db, slug: string) {
	const asNum = Number(slug);
	const condition =
		!Number.isNaN(asNum) && Number.isInteger(asNum)
			? or(eq(categories.slug, slug), eq(categories.id, asNum))
			: eq(categories.slug, slug);

	const [category] = await db.select().from(categories).where(condition).limit(1);

	return category ?? null;
}

export async function getCategoryRequests(
	db: Db,
	category: typeof categories.$inferSelect,
	params: {
		modality?: string | null;
		online?: boolean | string | null;
		helpType?: string | null;
		location?: string | null;
		sort?: string | null;
		page: number;
		limit: number;
		offset: number;
	},
): Promise<CategoryFeedResponse> {
	const { page, limit, offset, sort = 'newest' } = params;

	const conditions = buildFeedConditions({
		categoryId: category.id,
		modality: params.modality,
		online: params.online,
		helpType: params.helpType,
		location: params.location,
	});

	const orderExpr =
		sort === 'most_supported'
			? sql`${desc(requests.voteCount)}, ${desc(requests.createdAt)}, ${desc(requests.id)}`
			: sort === 'still_open'
				? asc(requests.publishedAt)
				: sql`${desc(requests.createdAt)}, ${desc(requests.id)}`;

	const rows = await db
		.select()
		.from(requests)
		.where(and(...conditions))
		.orderBy(orderExpr)
		.limit(limit)
		.offset(offset);

	const items: FeedItemResponse[] = rows.map((row) => ({
		...toResponse(row),
		voteCount: row.voteCount,
		category: {
			id: category.id,
			name: category.name,
			slug: category.slug,
		},
	}));

	const [countRow] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(requests)
		.where(and(...conditions));
	const total = countRow?.count ?? 0;

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
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function searchRequests(
	db: Db,
	params: {
		q: string;
		categoryId?: number | null;
		modality?: string | null;
		online?: boolean | string | null;
		helpType?: string | null;
		location?: string | null;
		sort?: string | null;
		page: number;
		limit: number;
		offset: number;
	},
): Promise<SearchFeedResponse> {
	const { q, page, limit, offset, sort = 'relevance' } = params;

	if (!q.trim()) {
		return {
			items: [],
			query: q,
			pagination: { page, limit, total: 0, totalPages: 0 },
		};
	}

	const searchQuery = sql`${q}::text`;
	const simpleQuery = sql`plainto_tsquery('simple', ${searchQuery})`;
	const englishQuery = sql`plainto_tsquery('english', ${searchQuery})`;

	const tsvectorMatch = sql`(${requests.searchVector} @@ ${simpleQuery} OR to_tsvector('english', coalesce(${requests.title}, '') || ' ' || coalesce(${requests.goal}, '') || ' ' || coalesce(${requests.barrier}, '') || ' ' || coalesce(${requests.helpNeeded}, '')) @@ ${englishQuery})`;
	const trigramMatch = sql`(${requests.title} % ${searchQuery} OR ${requests.goal} % ${searchQuery})`;
	const searchCondition = or(tsvectorMatch, trigramMatch);

	const conditions = buildFeedConditions({
		categoryId: params.categoryId,
		modality: params.modality,
		online: params.online,
		helpType: params.helpType,
		location: params.location,
	});

	if (searchCondition) {
		conditions.push(searchCondition);
	}

	const relevanceExpr = sql<number>`greatest(ts_rank(${requests.searchVector}, ${simpleQuery}) + ts_rank(to_tsvector('english', coalesce(${requests.title}, '') || ' ' || coalesce(${requests.goal}, '') || ' ' || coalesce(${requests.barrier}, '') || ' ' || coalesce(${requests.helpNeeded}, '')), ${englishQuery}), similarity(${requests.title}, ${searchQuery}))`;

	const orderExpr =
		sort === 'newest'
			? sql`${desc(requests.createdAt)}, ${desc(requests.id)}`
			: sort === 'most_supported'
				? sql`${desc(requests.voteCount)}, ${desc(requests.createdAt)}, ${desc(requests.id)}`
				: sort === 'still_open'
					? asc(requests.publishedAt)
					: desc(relevanceExpr);

	const rows = await db
		.select({
			request: requests,
			relevance: relevanceExpr,
			category: {
				id: categories.id,
				name: categories.name,
				slug: categories.slug,
			},
		})
		.from(requests)
		.leftJoin(categories, eq(requests.categoryId, categories.id))
		.where(and(...conditions))
		.orderBy(orderExpr)
		.limit(limit)
		.offset(offset);

	const items: FeedItemResponse[] = rows.map(({ request, relevance, category }) => ({
		...toResponse(request),
		voteCount: request.voteCount,
		relevance,
		category: category?.id ? category : null,
	}));

	const [countRow] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(requests)
		.where(and(...conditions));
	const total = countRow?.count ?? 0;

	return {
		items,
		query: q,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function getAllCategories(db: Db) {
	const rows = await db.select().from(categories).orderBy(categories.name);

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
}
