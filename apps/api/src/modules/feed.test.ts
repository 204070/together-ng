import { beforeEach, describe, expect, test } from 'bun:test';
import { getDatabase, sql } from '@together/db';
import {
	createCategory,
	createRequestFixture,
	makeTestApp,
	unique,
	userAuth,
} from '../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(async () => {
	await getDatabase().execute(sql`TRUNCATE requests CASCADE`);
	app = makeTestApp();
});

describe('GET /requests/featured', () => {
	test('returns pagination metadata', async () => {
		const { id } = await createRequestFixture({ state: 'published' });
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			items: Array<{ id: string }>;
			pagination: { page: number; limit: number; total: number; totalPages: number };
		};
		expect(body.pagination).toBeDefined();
		expect(body.pagination.page).toBe(1);
		expect(body.pagination.limit).toBe(20);
		expect(body.items.some((i) => i.id === id)).toBe(true);
		expect(body.pagination.total).toBeGreaterThanOrEqual(1);
	});

	test('published request appears in the response', async () => {
		const { id } = await createRequestFixture({
			state: 'published',
			title: 'Feed seed title',
		});
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: Array<{ id: string; title: string }> };
		expect(body.items.map((item) => item.id)).toContain(id);
		expect(body.items.map((item) => item.title)).toContain('Feed seed title');
	});

	test('draft requests are excluded from featured', async () => {
		const { id } = await createRequestFixture({
			state: 'draft',
			title: 'Draft stays hidden',
		});
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).not.toContain(id);
	});

	test('archived requests are excluded from featured', async () => {
		const { id } = await createRequestFixture({
			state: 'archived',
			title: 'Archived stays hidden',
		});
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).not.toContain(id);
	});

	test('under_review requests are excluded from featured', async () => {
		const { id } = await createRequestFixture({
			state: 'under_review',
			title: 'Under review hidden',
		});
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).not.toContain(id);
	});

	test('literal /requests/featured wins over GET /requests/:id', async () => {
		await createRequestFixture({ state: 'published', title: 'Literal route title' });
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(Array.isArray(body.items)).toBe(true);
	});

	test('includes vote count', async () => {
		const { id: requestId } = await createRequestFixture({ state: 'published' });
		const { headers } = await userAuth();

		await app.handle(
			new Request(`http://localhost/requests/${requestId}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...headers },
			}),
		);

		const res = await app.handle(new Request('http://localhost/requests/featured'));
		const body = (await res.json()) as { items: Array<{ id: string; voteCount: number }> };
		const item = body.items.find((i) => i.id === requestId);
		expect(item).toBeDefined();
		expect(item?.voteCount).toBe(1);
	});

	test('pagination respects page and limit params', async () => {
		const category = await createCategory(unique('page-cat'));
		for (let i = 0; i < 5; i++) {
			await createRequestFixture({
				state: 'published',
				category,
				title: `Page request ${i}`,
			});
		}

		const res = await app.handle(
			new Request(`http://localhost/requests/featured?page=1&limit=2&categoryId=${category.id}`),
		);
		const body = (await res.json()) as {
			items: unknown[];
			pagination: { page: number; limit: number; total: number; totalPages: number };
		};
		expect(body.items.length).toBe(2);
		expect(body.pagination.total).toBe(5);
		expect(body.pagination.totalPages).toBe(3);
	});

	test('sort=newest orders by createdAt descending', async () => {
		const category = await createCategory(unique('sort-newest'));
		const older = await createRequestFixture({
			state: 'published',
			category,
			title: 'Older request',
		});
		const newer = await createRequestFixture({
			state: 'published',
			category,
			title: 'Newer request',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/featured?sort=newest&categoryId=${category.id}`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; title: string }> };
		const ids = body.items.map((i) => i.id);
		expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
	});

	test('sort=most_supported orders by vote count descending', async () => {
		const category = await createCategory(unique('sort-votes'));
		const lowVotes = await createRequestFixture({
			state: 'published',
			category,
			title: 'Low votes',
		});
		const highVotes = await createRequestFixture({
			state: 'published',
			category,
			title: 'High votes',
		});

		for (let i = 0; i < 3; i++) {
			const voter = await userAuth();
			await app.handle(
				new Request(`http://localhost/requests/${highVotes.id}/vote`, {
					method: 'POST',
					headers: { 'content-type': 'application/json', ...voter.headers },
				}),
			);
		}

		const voter = await userAuth();
		await app.handle(
			new Request(`http://localhost/requests/${lowVotes.id}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...voter.headers },
			}),
		);

		const res = await app.handle(
			new Request(
				`http://localhost/requests/featured?sort=most_supported&categoryId=${category.id}`,
			),
		);
		const body = (await res.json()) as { items: Array<{ id: string; voteCount: number }> };
		expect(body.items[0].id).toBe(highVotes.id);
		expect(body.items[0].voteCount).toBe(3);
		expect(body.items[1].id).toBe(lowVotes.id);
		expect(body.items[1].voteCount).toBe(1);
	});

	test('filter by categoryId', async () => {
		const category = await createCategory(unique('cat-filter'));
		const { id: catReq } = await createRequestFixture({
			state: 'published',
			category,
			title: 'Categorized request',
		});

		const otherCategory = await createCategory(unique('other-cat'));
		const { id: otherReq } = await createRequestFixture({
			state: 'published',
			category: otherCategory,
			title: 'Other categorized request',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/featured?categoryId=${category.id}`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; categoryId: number }> };
		expect(body.items.map((i) => i.id)).toContain(catReq);
		expect(body.items.map((i) => i.id)).not.toContain(otherReq);
	});

	test('filter by modality', async () => {
		const category = await createCategory(unique('mod-filter'));
		const { id: onlineId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'online',
			title: 'Online request',
		});
		const { id: inPersonId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'in_person',
			title: 'In person request',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/featured?modality=online&categoryId=${category.id}`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; modality: string }> };
		expect(body.items.map((i) => i.id)).toContain(onlineId);
		expect(body.items.map((i) => i.id)).not.toContain(inPersonId);
	});

	test('filter by helpType', async () => {
		const category = await createCategory(unique('ht-filter'));
		const { id: learnId } = await createRequestFixture({
			state: 'published',
			category,
			helpType: 'learn',
			title: 'Learn request',
		});
		const { id: borrowId } = await createRequestFixture({
			state: 'published',
			category,
			helpType: 'borrow',
			title: 'Borrow request',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/featured?helpType=learn&categoryId=${category.id}`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; helpType: string }> };
		expect(body.items.map((i) => i.id)).toContain(learnId);
		expect(body.items.map((i) => i.id)).not.toContain(borrowId);
	});

	test('filter by location', async () => {
		const category = await createCategory(unique('loc-filter'));
		const { id: localId } = await createRequestFixture({
			state: 'published',
			category,
			location: 'Portland, OR',
			title: 'Portland request',
		});
		const { id: otherId } = await createRequestFixture({
			state: 'published',
			category,
			location: 'Seattle, WA',
			title: 'Seattle request',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/featured?location=portland&categoryId=${category.id}`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; location: string }> };
		expect(body.items.map((i) => i.id)).toContain(localId);
		expect(body.items.map((i) => i.id)).not.toContain(otherId);
	});

	test('combines multiple filters', async () => {
		const category = await createCategory(unique('combo-filter'));
		const { id: matchId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'online',
			helpType: 'learn',
			title: 'Matches all',
		});
		const { id: wrongModId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'in_person',
			title: 'Wrong modality',
		});

		const res = await app.handle(
			new Request(
				`http://localhost/requests/featured?categoryId=${category.id}&modality=online&helpType=learn`,
			),
		);
		const body = (await res.json()) as { items: Array<{ id: string; title: string }> };
		expect(body.items.map((i) => i.id)).toContain(matchId);
		expect(body.items.map((i) => i.id)).not.toContain(wrongModId);
	});

	test('default sort is vote-weighted', async () => {
		const category = await createCategory(unique('default-vote'));
		await createRequestFixture({
			state: 'published',
			category,
			title: 'Less popular',
		});
		const morePopular = await createRequestFixture({
			state: 'published',
			category,
			title: 'More popular',
		});

		for (let i = 0; i < 3; i++) {
			const voter = await userAuth();
			await app.handle(
				new Request(`http://localhost/requests/${morePopular.id}/vote`, {
					method: 'POST',
					headers: { 'content-type': 'application/json', ...voter.headers },
				}),
			);
		}

		const res = await app.handle(
			new Request(`http://localhost/requests/featured?categoryId=${category.id}`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; voteCount: number }> };
		expect(body.items[0].id).toBe(morePopular.id);
		expect(body.items[0].voteCount).toBe(3);
	});

	test('returns empty items when no requests match', async () => {
		const res = await app.handle(new Request('http://localhost/requests/featured'));
		const body = (await res.json()) as {
			items: unknown[];
			pagination: { total: number };
		};
		expect(body.items).toEqual([]);
		expect(body.pagination.total).toBe(0);
	});
});

describe('GET /categories/:slug/requests', () => {
	test('returns category not found error for invalid slug', async () => {
		const res = await app.handle(new Request('http://localhost/categories/nonexistent/requests'));
		const body = (await res.json()) as { error: string; items: unknown[] };
		expect(body.error).toBe('CATEGORY_NOT_FOUND');
		expect(body.items).toEqual([]);
	});

	test('returns empty items for category with no requests', async () => {
		const category = await createCategory(unique('empty-cat'));
		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests`),
		);
		const body = (await res.json()) as { items: unknown[]; pagination: { total: number } };
		expect(body.items).toEqual([]);
		expect(body.pagination.total).toBe(0);
	});

	test('returns requests for a specific category', async () => {
		const category = await createCategory(unique('tech-support'));
		const { id: catReq } = await createRequestFixture({
			state: 'published',
			category,
			title: 'Tech help needed',
		});

		const otherCategory = await createCategory(unique('other-cat'));
		const { id: otherReq } = await createRequestFixture({
			state: 'published',
			category: otherCategory,
			title: 'Different category',
		});

		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests`),
		);
		const body = (await res.json()) as {
			items: Array<{ id: string }>;
			category: { slug: string };
			pagination: { total: number };
		};
		expect(body.category.slug).toBe(category.slug);
		expect(body.items.map((i) => i.id)).toContain(catReq);
		expect(body.items.map((i) => i.id)).not.toContain(otherReq);
		expect(body.pagination.total).toBeGreaterThanOrEqual(1);
	});

	test('excludes draft requests in category feed', async () => {
		const category = await createCategory(unique('drafts-test'));
		const { id: draftId } = await createRequestFixture({
			state: 'draft',
			category,
			title: 'Draft request',
		});

		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests`),
		);
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).not.toContain(draftId);
	});

	test('pagination works for category feed', async () => {
		const category = await createCategory(unique('paginated-cat'));
		for (let i = 0; i < 3; i++) {
			await createRequestFixture({
				state: 'published',
				category,
				title: `Request ${i}`,
			});
		}

		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests?page=1&limit=2`),
		);
		const body = (await res.json()) as {
			items: unknown[];
			pagination: { total: number; totalPages: number };
		};
		expect(body.items.length).toBe(2);
		expect(body.pagination.total).toBe(3);
		expect(body.pagination.totalPages).toBe(2);
	});

	test('sort=most_supported orders by vote count', async () => {
		const category = await createCategory(unique('votes-sort'));
		const lowVotes = await createRequestFixture({
			state: 'published',
			category,
			title: 'Low votes',
		});
		const highVotes = await createRequestFixture({
			state: 'published',
			category,
			title: 'High votes',
		});

		for (let i = 0; i < 2; i++) {
			const voter = await userAuth();
			await app.handle(
				new Request(`http://localhost/requests/${highVotes.id}/vote`, {
					method: 'POST',
					headers: { 'content-type': 'application/json', ...voter.headers },
				}),
			);
		}

		const voter = await userAuth();
		await app.handle(
			new Request(`http://localhost/requests/${lowVotes.id}/vote`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...voter.headers },
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests?sort=most_supported`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; voteCount: number }> };
		expect(body.items[0].id).toBe(highVotes.id);
		expect(body.items[0].voteCount).toBe(2);
	});

	test('filter by modality in category feed', async () => {
		const category = await createCategory(unique('modal-filter'));
		const { id: onlineId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'online',
			title: 'Online only',
		});
		const { id: inPersonId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'in_person',
			title: 'In person only',
		});

		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests?modality=online`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; modality: string }> };
		expect(body.items.map((i) => i.id)).toContain(onlineId);
		expect(body.items.map((i) => i.id)).not.toContain(inPersonId);
	});

	test('filter by helpType in category feed', async () => {
		const category = await createCategory(unique('type-filter'));
		const { id: learnId } = await createRequestFixture({
			state: 'published',
			category,
			helpType: 'learn',
			title: 'Learn request',
		});
		const { id: borrowId } = await createRequestFixture({
			state: 'published',
			category,
			helpType: 'borrow',
			title: 'Borrow request',
		});

		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests?helpType=learn`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; helpType: string }> };
		expect(body.items.map((i) => i.id)).toContain(learnId);
		expect(body.items.map((i) => i.id)).not.toContain(borrowId);
	});

	test('filter by location in category feed', async () => {
		const category = await createCategory(unique('loc-cat-filter'));
		const { id: localId } = await createRequestFixture({
			state: 'published',
			category,
			location: 'Austin, TX',
			title: 'Austin request',
		});
		const { id: otherId } = await createRequestFixture({
			state: 'published',
			category,
			location: 'Denver, CO',
			title: 'Denver request',
		});

		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests?location=austin`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; location: string }> };
		expect(body.items.map((i) => i.id)).toContain(localId);
		expect(body.items.map((i) => i.id)).not.toContain(otherId);
	});

	test('returns category metadata in response', async () => {
		const category = await createCategory(unique('with-meta'));
		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests`),
		);
		const body = (await res.json()) as {
			category: { id: number; name: string; slug: string; description: string | null };
		};
		expect(body.category.id).toBe(category.id);
		expect(body.category.name).toBe(category.slug);
		expect(body.category.slug).toBe(category.slug);
	});

	test('sort=still_open orders by publishedAt ascending', async () => {
		const category = await createCategory(unique('still-open'));
		const older = await createRequestFixture({
			state: 'published',
			category,
			title: 'Older published',
		});
		const newer = await createRequestFixture({
			state: 'published',
			category,
			title: 'Newer published',
		});

		const res = await app.handle(
			new Request(`http://localhost/categories/${category.slug}/requests?sort=still_open`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; title: string }> };
		const ids = body.items.map((i) => i.id);
		expect(ids.indexOf(older.id)).toBeLessThan(ids.indexOf(newer.id));
	});
});

describe('GET /requests/search', () => {
	test('returns empty items when q is empty', async () => {
		const res = await app.handle(new Request('http://localhost/requests/search?q='));
		const body = (await res.json()) as { items: unknown[] };
		expect(body.items).toEqual([]);
	});

	test('search finds requests by title', async () => {
		const searchTerm = unique('searchable');
		const { id } = await createRequestFixture({
			state: 'published',
			title: `Help with ${searchTerm} project`,
			goal: 'Install solar panels',
			barrier: 'No expertise',
			helpNeeded: 'Electrician guidance',
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as {
			items: Array<{ id: string; title: string }>;
			query: string;
		};
		expect(body.items.map((i) => i.id)).toContain(id);
		expect(body.query).toBe(searchTerm);
	});

	test('search finds requests by goal text', async () => {
		const searchTerm = unique('goalterm');
		const { id } = await createRequestFixture({
			state: 'published',
			title: 'Community garden project',
			goal: `Need ${searchTerm} and gardening tools`,
			barrier: 'No equipment',
			helpNeeded: 'Gardening supplies',
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).toContain(id);
	});

	test('search finds requests by helpNeeded text', async () => {
		const searchTerm = unique('mentor');
		const { id } = await createRequestFixture({
			state: 'published',
			title: 'Web development help',
			goal: 'Learn React',
			barrier: 'Self-taught gaps',
			helpNeeded: `Experienced developer for ${searchTerm}`,
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).toContain(id);
	});

	test('search excludes draft requests', async () => {
		const searchTerm = unique('draftonly');
		const { id } = await createRequestFixture({
			state: 'draft',
			title: `Draft ${searchTerm} project`,
			goal: 'Draft goal',
			barrier: 'Draft barrier',
			helpNeeded: 'Draft help',
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).not.toContain(id);
	});

	test('search excludes archived requests', async () => {
		const searchTerm = unique('archivedonly');
		const { id } = await createRequestFixture({
			state: 'archived',
			title: `Archived ${searchTerm} project`,
			goal: 'Archived goal',
			barrier: 'Archived barrier',
			helpNeeded: 'Archived help',
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).not.toContain(id);
	});

	test('search excludes under_review requests', async () => {
		const searchTerm = unique('reviewonly');
		const { id } = await createRequestFixture({
			state: 'under_review',
			title: `Under review ${searchTerm} project`,
			goal: 'Review goal',
			barrier: 'Review barrier',
			helpNeeded: 'Review help',
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).not.toContain(id);
	});

	test('search with category slug filter', async () => {
		const searchTerm = unique('catsearch');
		const category = await createCategory(unique('cat-search'));
		const { id: matchId } = await createRequestFixture({
			state: 'published',
			category,
			title: `${searchTerm} coding help`,
			goal: 'Learn to code',
			barrier: 'No mentor',
			helpNeeded: 'Coding tutor',
		});

		const otherCategory = await createCategory(unique('other-cat'));
		const { id: otherId } = await createRequestFixture({
			state: 'published',
			category: otherCategory,
			title: `${searchTerm} general coding`,
			goal: 'General coding',
			barrier: 'Time',
			helpNeeded: 'Pair programmer',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/search?q=${searchTerm}&category=${category.slug}`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; categoryId: number }> };
		expect(body.items.map((i) => i.id)).toContain(matchId);
		expect(body.items.map((i) => i.id)).not.toContain(otherId);
	});

	test('search with nonexistent category returns empty', async () => {
		const searchTerm = unique('nocat');
		await createRequestFixture({
			state: 'published',
			title: `${searchTerm} help`,
			goal: 'Goal',
			barrier: 'Barrier',
			helpNeeded: 'Help',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/search?q=${searchTerm}&category=nonexistent-slug`),
		);
		const body = (await res.json()) as { items: unknown[] };
		expect(body.items).toEqual([]);
	});

	test('search with modality filter', async () => {
		const searchTerm = unique('modsearch');
		const category = await createCategory(unique('mod-search-cat'));
		const { id: onlineId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'online',
			title: `Online ${searchTerm} workshop`,
			goal: 'Learn online',
			barrier: 'Remote only',
			helpNeeded: 'Online tutor',
		});
		const { id: inPersonId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'in_person',
			title: `In person ${searchTerm} help`,
			goal: 'Learn in person',
			barrier: 'Local only',
			helpNeeded: 'Local tutor',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/search?q=${searchTerm}&modality=online`),
		);
		const body = (await res.json()) as {
			items: Array<{ id: string; modality: string }>;
		};
		expect(body.items.map((i) => i.id)).toContain(onlineId);
		expect(body.items.map((i) => i.id)).not.toContain(inPersonId);
	});

	test('search with helpType filter', async () => {
		const searchTerm = unique('htsearch');
		const category = await createCategory(unique('ht-search-cat'));
		const { id: learnId } = await createRequestFixture({
			state: 'published',
			category,
			helpType: 'learn',
			title: `Learn ${searchTerm} basics`,
			goal: 'Learn guitar',
			barrier: 'No instrument',
			helpNeeded: 'Guitar teacher',
		});
		const { id: borrowId } = await createRequestFixture({
			state: 'published',
			category,
			helpType: 'borrow',
			title: `Borrow ${searchTerm} equipment`,
			goal: 'Borrow guitar',
			barrier: 'No budget',
			helpNeeded: 'Guitar loan',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/search?q=${searchTerm}&helpType=learn`),
		);
		const body = (await res.json()) as {
			items: Array<{ id: string; helpType: string }>;
		};
		expect(body.items.map((i) => i.id)).toContain(learnId);
		expect(body.items.map((i) => i.id)).not.toContain(borrowId);
	});

	test('search with location filter', async () => {
		const searchTerm = unique('locsearch');
		const category = await createCategory(unique('loc-search-cat'));
		const { id: localId } = await createRequestFixture({
			state: 'published',
			category,
			location: 'Chicago, IL',
			title: `Chicago ${searchTerm} help`,
			goal: 'Local help',
			barrier: 'None',
			helpNeeded: 'Chicago tutor',
		});
		const { id: otherId } = await createRequestFixture({
			state: 'published',
			category,
			location: 'Miami, FL',
			title: `Miami ${searchTerm} help`,
			goal: 'Remote help',
			barrier: 'None',
			helpNeeded: 'Miami tutor',
		});

		const res = await app.handle(
			new Request(`http://localhost/requests/search?q=${searchTerm}&location=chicago`),
		);
		const body = (await res.json()) as { items: Array<{ id: string; location: string }> };
		expect(body.items.map((i) => i.id)).toContain(localId);
		expect(body.items.map((i) => i.id)).not.toContain(otherId);
	});

	test('search combines multiple filters', async () => {
		const searchTerm = unique('combsearch');
		const category = await createCategory(unique('comb-search'));
		const { id: matchId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'online',
			helpType: 'learn',
			title: `Online ${searchTerm} lessons`,
			goal: 'Learn piano online',
			barrier: 'No teacher',
			helpNeeded: 'Online piano tutor',
		});
		const { id: otherId } = await createRequestFixture({
			state: 'published',
			category,
			modality: 'in_person',
			title: `In person ${searchTerm} lessons`,
			goal: 'Learn piano',
			barrier: 'No teacher',
			helpNeeded: 'Local piano tutor',
		});

		const res = await app.handle(
			new Request(
				`http://localhost/requests/search?q=${searchTerm}&category=${category.slug}&modality=online&helpType=learn`,
			),
		);
		const body = (await res.json()) as { items: Array<{ id: string; title: string }> };
		expect(body.items.map((i) => i.id)).toContain(matchId);
		expect(body.items.map((i) => i.id)).not.toContain(otherId);
	});

	test('search returns relevance scores', async () => {
		const searchTerm = unique('relscore');
		await createRequestFixture({
			state: 'published',
			title: `${searchTerm} installation help`,
			goal: 'Install panels on community center',
			barrier: 'No expertise',
			helpNeeded: `Electrician for ${searchTerm}`,
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as { items: Array<{ relevance: number }> };
		expect(body.items.length).toBeGreaterThanOrEqual(1);
		expect(body.items[0].relevance).toBeGreaterThan(0);
	});

	test('search returns pagination metadata', async () => {
		const searchTerm = unique('pagesearch');
		await createRequestFixture({
			state: 'published',
			title: `${searchTerm} project`,
			goal: `${searchTerm} goal`,
			barrier: `${searchTerm} barrier`,
			helpNeeded: `${searchTerm} help`,
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as {
			pagination: { page: number; limit: number; total: number; totalPages: number };
		};
		expect(body.pagination).toBeDefined();
		expect(body.pagination.page).toBe(1);
		expect(body.pagination.total).toBeGreaterThanOrEqual(1);
	});

	test('search pagination works', async () => {
		const searchTerm = unique('pagsearch');
		for (let i = 0; i < 5; i++) {
			await createRequestFixture({
				state: 'published',
				title: `${searchTerm} project ${i}`,
				goal: `${searchTerm} goal ${i}`,
				barrier: `${searchTerm} barrier`,
				helpNeeded: `${searchTerm} help`,
			});
		}

		const res = await app.handle(
			new Request(`http://localhost/requests/search?q=${searchTerm}&page=1&limit=2`),
		);
		const body = (await res.json()) as {
			items: unknown[];
			pagination: { total: number; totalPages: number };
		};
		expect(body.items.length).toBe(2);
		expect(body.pagination.total).toBe(5);
		expect(body.pagination.totalPages).toBe(3);
	});

	test('search sort=newest orders by createdAt', async () => {
		const searchTerm = unique('sortsearch');
		const category = await createCategory(unique('sort-search-cat'));
		await createRequestFixture({
			state: 'published',
			category,
			title: `Older ${searchTerm} project`,
			goal: 'Old goal',
			barrier: 'Old barrier',
			helpNeeded: 'Old help',
		});
		await createRequestFixture({
			state: 'published',
			category,
			title: `Newer ${searchTerm} project`,
			goal: 'New goal',
			barrier: 'New barrier',
			helpNeeded: 'New help',
		});

		const res = await app.handle(
			new Request(
				`http://localhost/requests/search?q=${searchTerm}&sort=newest&category=${category.slug}`,
			),
		);
		const body = (await res.json()) as { items: Array<{ title: string }> };
		expect(body.items.length).toBeGreaterThanOrEqual(2);
		expect(body.items[0].title).toContain('Newer');
	});

	test('search sort=relevance is default', async () => {
		const searchTerm = unique('defsort');
		await createRequestFixture({
			state: 'published',
			title: `${searchTerm} panel installation`,
			goal: 'Install',
			barrier: 'No skills',
			helpNeeded: `${searchTerm} installer`,
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as { items: Array<{ relevance: number }> };
		expect(body.items[0].relevance).toBeGreaterThan(0);
	});

	test('search with no results returns empty', async () => {
		const searchTerm = unique('zzznonexistent');
		await createRequestFixture({
			state: 'published',
			title: 'Book donation',
			goal: 'Collect books',
			barrier: 'Transport',
			helpNeeded: 'Drivers',
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as {
			items: unknown[];
			pagination: { total: number };
		};
		expect(body.items).toEqual([]);
		expect(body.pagination.total).toBe(0);
	});

	test('search excludes closed requests', async () => {
		const searchTerm = unique('closedonly');
		const { id } = await createRequestFixture({
			state: 'closed',
			title: `Closed ${searchTerm} project`,
			goal: 'Closed goal',
			barrier: 'Closed barrier',
			helpNeeded: 'Closed help',
		});

		const res = await app.handle(new Request(`http://localhost/requests/search?q=${searchTerm}`));
		const body = (await res.json()) as { items: Array<{ id: string }> };
		expect(body.items.map((i) => i.id)).not.toContain(id);
	});
});
