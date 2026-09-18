import { getApiConfig } from '../../config';
import type { Db } from '../../infra/database';
import { createRedisService, MockRedisService, type RedisService } from '../../infra/redis';
import {
	type CategoryFeedResponse,
	type FeedResponse,
	getAllCategories,
	getCategoryBySlug,
	getCategoryRequests,
	getFeaturedRequests,
	parsePagination,
	resolveCategoryId,
	type SearchFeedResponse,
	searchRequests as storeSearchRequests,
} from './store';

export const FEATURED_CACHE_TTL_SECONDS = 30;

let defaultRedis: RedisService | null = null;

export function getFeedRedis(): RedisService {
	if (!defaultRedis) {
		const config = getApiConfig();
		if (config.isTest) {
			defaultRedis = new MockRedisService();
		} else {
			defaultRedis = createRedisService(config.redisUrl);
		}
	}
	return defaultRedis;
}

export function setFeedRedis(service: RedisService | null): void {
	defaultRedis = service;
}

export interface FeedQueryOptions {
	sort?: string;
	categoryId?: string | number;
	category?: string | number;
	modality?: string;
	online?: boolean | string;
	helpType?: string;
	location?: string;
	page?: string | number;
	limit?: string | number;
}

export interface SearchQueryOptions extends FeedQueryOptions {
	q: string;
}

export class FeedService {
	private readonly customRedis?: RedisService;

	constructor(
		private readonly db: Db,
		redis?: RedisService,
	) {
		this.customRedis = redis;
	}

	private get redis(): RedisService {
		return this.customRedis ?? getFeedRedis();
	}

	async getFeaturedFeed(query: FeedQueryOptions): Promise<FeedResponse> {
		const { page, limit, offset } = parsePagination(query);
		const sort = (query.sort as string) || 'most_supported';

		let categoryId: number | null = null;
		if (query.categoryId) {
			const resolved = await resolveCategoryId(this.db, query.categoryId);
			if (resolved === 'NOT_FOUND') {
				return {
					items: [],
					pagination: { page, limit, total: 0, totalPages: 0 },
				};
			}
			categoryId = resolved;
		} else if (query.category) {
			const resolved = await resolveCategoryId(this.db, query.category);
			if (resolved === 'NOT_FOUND') {
				return {
					items: [],
					pagination: { page, limit, total: 0, totalPages: 0 },
				};
			}
			categoryId = resolved;
		}

		const cacheKey = `feed:featured:${sort}:${page}:${limit}:${categoryId ?? ''}:${query.modality ?? ''}:${query.helpType ?? ''}:${query.location ?? ''}`;

		try {
			const cached = await this.redis.get(cacheKey);
			if (cached) {
				try {
					return JSON.parse(cached);
				} catch {
					// corrupted cache fallback to db
				}
			}
		} catch {
			// Redis read error gracefully degrades to database
		}

		const result = await getFeaturedRequests(this.db, {
			categoryId,
			modality: query.modality,
			online: query.online,
			helpType: query.helpType,
			location: query.location,
			sort,
			page,
			limit,
			offset,
		});

		try {
			await this.redis.set(cacheKey, JSON.stringify(result), {
				ex: FEATURED_CACHE_TTL_SECONDS,
			});
		} catch {
			// ignore redis write failures
		}

		return result;
	}

	async getCategoryFeed(slug: string, query: FeedQueryOptions): Promise<CategoryFeedResponse> {
		const { page, limit, offset } = parsePagination(query);
		const sort = (query.sort as string) || 'newest';

		const category = await getCategoryBySlug(this.db, slug);

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

		return getCategoryRequests(this.db, category, {
			modality: query.modality,
			online: query.online,
			helpType: query.helpType,
			location: query.location,
			sort,
			page,
			limit,
			offset,
		});
	}

	async searchRequests(query: SearchQueryOptions): Promise<SearchFeedResponse> {
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

		let categoryId: number | null = null;
		if (query.category) {
			const resolved = await resolveCategoryId(this.db, query.category);
			if (resolved === 'NOT_FOUND' || resolved === null) {
				return {
					items: [],
					query: q,
					pagination: { page, limit, total: 0, totalPages: 0 },
				};
			}
			categoryId = resolved;
		} else if (query.categoryId) {
			const resolved = await resolveCategoryId(this.db, query.categoryId);
			if (resolved === 'NOT_FOUND' || resolved === null) {
				return {
					items: [],
					query: q,
					pagination: { page, limit, total: 0, totalPages: 0 },
				};
			}
			categoryId = resolved;
		}

		return storeSearchRequests(this.db, {
			q,
			categoryId,
			modality: query.modality,
			online: query.online,
			helpType: query.helpType,
			location: query.location,
			sort,
			page,
			limit,
			offset,
		});
	}

	async getCategories() {
		return getAllCategories(this.db);
	}
}

export function createFeedService(db: Db, redis?: RedisService) {
	return new FeedService(db, redis);
}
