import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lib/server', () => ({
	getFeaturedFn: vi.fn(),
	getCategoryFeedFn: vi.fn(),
	searchRequestsFn: vi.fn(),
	getCategoriesFn: vi.fn(),
	getAuthUserFn: vi.fn(),
}));

import { EmptyFeed } from '../components/feed/empty-feed';
import { FeedFilters } from '../components/feed/feed-filters';
import { FeedSkeleton } from '../components/feed/feed-skeleton';
import {
	formatLocationOrModality,
	formatStateBadge,
	RequestCard,
} from '../components/feed/request-card';
import {
	getAuthUserFn,
	getCategoriesFn,
	getCategoryFeedFn,
	getFeaturedFn,
	searchRequestsFn,
} from '../lib/server';
import { CategoryErrorPage } from '../routes/categories/$categorySlug';
import { FeedErrorPage } from '../routes/index';
import { routeTree } from '../routeTree.gen';

afterEach(() => cleanup());

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getCategoriesFn).mockResolvedValue({ items: [] } as never);
	vi.mocked(getAuthUserFn).mockResolvedValue({ user: null, profile: null } as never);
	vi.mocked(getFeaturedFn).mockResolvedValue({
		items: [],
		pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
	} as never);
	vi.mocked(getCategoryFeedFn).mockResolvedValue({
		items: [],
		pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
	} as never);
	vi.mocked(searchRequestsFn).mockResolvedValue({
		items: [],
		query: '',
		pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
	} as never);
});

function renderInTestRouter(ui: React.ReactElement) {
	const root = createRootRoute({
		component: () => ui,
	});
	const reqRoute = createRoute({
		getParentRoute: () => root,
		path: '/requests/$requestId',
		component: () => <div />,
	});
	const newReqRoute = createRoute({
		getParentRoute: () => root,
		path: '/requests/new',
		component: () => <div />,
	});
	const router = createRouter({
		routeTree: root.addChildren([reqRoute, newReqRoute]),
		history: createMemoryHistory({ initialEntries: ['/'] }),
	});
	return render(<RouterProvider router={router} />);
}

function renderAppRoute(initialEntry = '/') {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: [initialEntry] }),
	});
	return render(<RouterProvider router={router} />);
}

describe('RequestCard', () => {
	const sampleRequest = {
		id: 'req-1',
		title: 'Need a laptop for learning React',
		goal: 'I want to build modern web applications and need a computer with at least 8GB RAM.',
		helpNeeded: 'Looking for a loaner laptop or donation.',
		state: 'published',
		modality: 'online',
		helpType: 'borrow',
		location: 'Lagos',
		voteCount: 14,
		createdAt: '2026-09-17T10:00:00.000Z',
		category: {
			id: 1,
			name: 'Technology',
			slug: 'technology',
		},
	};

	test('renders card details: title, snippet, category badge, location, vote count, state', async () => {
		renderInTestRouter(<RequestCard request={sampleRequest} />);

		// Title link
		const titleLink = await screen.findByTestId('request-title-link');
		expect(titleLink.textContent).toBe('Need a laptop for learning React');

		// Category badge
		const categoryBadge = screen.getByTestId('category-badge');
		expect(categoryBadge.textContent).toBe('Technology');

		// Location / modality (modality is 'online')
		const locationBadge = screen.getByTestId('location-badge');
		expect(locationBadge.textContent).toBe('Online');

		// State badge
		const stateBadge = screen.getByTestId('state-badge');
		expect(stateBadge.textContent).toBe('Published');

		// Goal snippet
		const snippet = screen.getByTestId('request-snippet');
		expect(snippet.textContent).toContain('I want to build modern web applications');

		// Vote count
		const voteCount = screen.getByTestId('vote-count');
		expect(voteCount.textContent).toBe('14 votes');
	});

	test('singular vote label when voteCount is 1', async () => {
		renderInTestRouter(<RequestCard request={{ ...sampleRequest, voteCount: 1 }} />);
		const voteCount = await screen.findByTestId('vote-count');
		expect(voteCount.textContent).toBe('1 vote');
	});

	test('falls back to helpNeeded when goal is empty', async () => {
		renderInTestRouter(
			<RequestCard request={{ ...sampleRequest, goal: null, helpNeeded: 'Borrowing tools' }} />,
		);
		const snippet = await screen.findByTestId('request-snippet');
		expect(snippet.textContent).toBe('Borrowing tools');
	});

	test('truncates snippet when text exceeds 160 chars', async () => {
		const longGoal = 'A'.repeat(200);
		renderInTestRouter(<RequestCard request={{ ...sampleRequest, goal: longGoal }} />);
		const snippet = await screen.findByTestId('request-snippet');
		expect(snippet.textContent?.length).toBe(160);
		expect(snippet.textContent?.endsWith('...')).toBe(true);
	});

	test('formatLocationOrModality formats modality and location correctly', () => {
		expect(formatLocationOrModality({ modality: 'online' })).toBe('Online');
		expect(formatLocationOrModality({ modality: 'in_person', location: 'Abuja' })).toBe('Abuja');
		expect(formatLocationOrModality({ modality: 'in_person', location: null })).toBe('In person');
		expect(formatLocationOrModality({ modality: 'both', location: null })).toBe(
			'Online / In person',
		);
		expect(formatLocationOrModality({ modality: null, location: 'Kaduna' })).toBe('Kaduna');
		expect(formatLocationOrModality({ modality: null, location: null })).toBe('Online');
	});

	test('formatStateBadge formats all state values properly', () => {
		expect(formatStateBadge('published')).toBe('Published');
		expect(formatStateBadge('receiving_responses')).toBe('Receiving Responses');
		expect(formatStateBadge('help_arranged')).toBe('Help Arranged');
		expect(formatStateBadge('in_progress')).toBe('In Progress');
		expect(formatStateBadge('completed')).toBe('Completed');
		expect(formatStateBadge('closed')).toBe('Closed');
		expect(formatStateBadge('cancelled')).toBe('Cancelled');
		expect(formatStateBadge('draft')).toBe('Draft');
		expect(formatStateBadge('under_review')).toBe('Under Review');
	});
});

describe('EmptyFeed component', () => {
	test('renders empty search state with query and browse featured link', async () => {
		const handleReset = vi.fn();
		renderInTestRouter(<EmptyFeed type="search" query="quantum computing" onReset={handleReset} />);

		expect(await screen.findByTestId('empty-feed')).toBeTruthy();
		expect(screen.getByTestId('empty-feed-title').textContent).toBe(
			"No results for 'quantum computing'",
		);
		const browseLink = screen.getByTestId('browse-featured-link');
		expect(browseLink).toBeTruthy();

		const clearBtn = screen.getByTestId('reset-search-button');
		fireEvent.click(clearBtn);
		expect(handleReset).toHaveBeenCalledTimes(1);
	});

	test('renders empty category state with "No requests yet" and CTA to create request', async () => {
		renderInTestRouter(
			<EmptyFeed type="category" categoryName="Carpentry" categorySlug="carpentry" />,
		);

		expect(await screen.findByTestId('empty-feed')).toBeTruthy();
		expect(screen.getByTestId('empty-feed-title').textContent).toBe('No requests yet');
		expect(
			screen.getByText(/There are no active requests in Carpentry at the moment/),
		).toBeTruthy();

		const ctaLink = screen.getByTestId('create-request-cta');
		expect(ctaLink.textContent).toBe('Ask for help');

		const browseAll = screen.getByTestId('browse-all-link');
		expect(browseAll.textContent).toBe('Browse all requests');
	});

	test('renders generic empty feed state', async () => {
		renderInTestRouter(<EmptyFeed type="feed" />);

		expect(await screen.findByTestId('empty-feed')).toBeTruthy();
		expect(screen.getByTestId('empty-feed-title').textContent).toBe('No requests yet');
		expect(screen.getByTestId('create-request-cta')).toBeTruthy();
		expect(screen.getByTestId('browse-all-link')).toBeTruthy();
	});
});

describe('FeedSkeleton', () => {
	test('renders skeleton cards with accessible status role', () => {
		render(<FeedSkeleton count={4} />);

		const skeleton = screen.getByTestId('feed-skeleton');
		expect(skeleton.getAttribute('role')).toBe('status');
		expect(skeleton.getAttribute('aria-label')).toBe('Loading requests...');

		const cards = screen.getAllByTestId('feed-skeleton-card');
		expect(cards.length).toBe(4);
	});
});

describe('FeedFilters', () => {
	const sampleCategories = [
		{ id: 1, name: 'Technology', slug: 'technology', retiredAt: null },
		{ id: 2, name: 'Education', slug: 'education', retiredAt: null },
		{ id: 3, name: 'Old Dept', slug: 'old-dept', retiredAt: '2025-01-01T00:00:00.000Z' },
	];

	test('renders active categories and excludes retired categories', async () => {
		renderInTestRouter(<FeedFilters categories={sampleCategories} currentFilters={{}} />);

		const categorySelect = await screen.findByTestId('filter-category');
		expect(categorySelect).toBeTruthy();

		// Should contain Technology and Education, but NOT Old Dept
		expect(screen.getByRole('option', { name: 'Technology' })).toBeTruthy();
		expect(screen.getByRole('option', { name: 'Education' })).toBeTruthy();
		expect(screen.queryByRole('option', { name: 'Old Dept' })).toBeNull();
	});

	test('updates category, modality, helpType, location, sort combinably', async () => {
		const onFilterChange = vi.fn();
		renderInTestRouter(
			<FeedFilters
				categories={sampleCategories}
				currentFilters={{ category: 'technology' }}
				onFilterChange={onFilterChange}
			/>,
		);

		// Change modality
		const modalitySelect = await screen.findByTestId('filter-modality');
		fireEvent.change(modalitySelect, { target: { value: 'online' } });
		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({ category: 'technology', modality: 'online' }),
		);

		// Change helpType
		const helpTypeSelect = screen.getByTestId('filter-help-type');
		fireEvent.change(helpTypeSelect, { target: { value: 'borrow' } });
		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({ category: 'technology', helpType: 'borrow' }),
		);

		// Change location
		const locationInput = screen.getByTestId('filter-location');
		fireEvent.change(locationInput, { target: { value: 'Ikeja' } });
		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({ category: 'technology', location: 'Ikeja' }),
		);

		// Change sort
		const sortSelect = screen.getByTestId('filter-sort');
		fireEvent.change(sortSelect, { target: { value: 'newest' } });
		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({ category: 'technology', sort: 'newest' }),
		);
	});

	test('hides category select when hideCategory=true', async () => {
		renderInTestRouter(
			<FeedFilters categories={sampleCategories} currentFilters={{}} hideCategory={true} />,
		);
		expect(await screen.findByTestId('filter-modality')).toBeTruthy();
		expect(screen.queryByTestId('filter-category')).toBeNull();
	});

	test('reset filters button appears when active filters exist and clears filters', async () => {
		const onFilterChange = vi.fn();
		renderInTestRouter(
			<FeedFilters
				categories={sampleCategories}
				currentFilters={{ modality: 'online', sort: 'newest' }}
				onFilterChange={onFilterChange}
			/>,
		);

		const resetBtn = await screen.findByTestId('clear-filters-button');
		expect(resetBtn).toBeTruthy();
		fireEvent.click(resetBtn);

		expect(onFilterChange).toHaveBeenCalledWith(
			expect.objectContaining({ sort: 'most_supported' }),
		);
	});
});

describe('Featured Feed & Search Route (HomePage & FeedErrorPage)', () => {
	test('renders feed with requests, search input, and greeting', async () => {
		vi.mocked(getCategoriesFn).mockResolvedValue({
			items: [{ id: 1, name: 'Food', slug: 'food', retiredAt: null }],
		} as never);
		vi.mocked(getAuthUserFn).mockResolvedValue({
			user: { id: 'u1', email: 'test@example.com' },
			profile: { name: 'Amina' },
		} as never);
		vi.mocked(getFeaturedFn).mockResolvedValue({
			items: [
				{
					id: 'req-1',
					title: 'Food drive for students',
					goal: 'Provide weekly lunch boxes for 50 pupils.',
					state: 'published',
					voteCount: 9,
					modality: 'in_person',
					location: 'Lagos Island',
					category: { id: 1, name: 'Food', slug: 'food' },
				},
			],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
		} as never);

		renderAppRoute('/');

		expect(await screen.findByTestId('feed-heading')).toBeTruthy();
		expect(screen.getByTestId('feed-heading').textContent).toBe('Requests');
		expect(screen.getByTestId('user-greeting').textContent).toContain('Welcome back, Amina');
		expect(screen.getByTestId('search-input')).toBeTruthy();
		expect(screen.getByText('Food drive for students')).toBeTruthy();
		expect(screen.getByText('9 votes')).toBeTruthy();
	});

	test('renders empty search state when query has no matches', async () => {
		vi.mocked(getCategoriesFn).mockResolvedValue({ items: [] } as never);
		vi.mocked(getAuthUserFn).mockResolvedValue({ user: null, profile: null } as never);
		vi.mocked(searchRequestsFn).mockResolvedValue({
			items: [],
			query: 'nonexistent-query',
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		} as never);

		renderAppRoute('/?q=nonexistent-query');

		expect(await screen.findByTestId('feed-heading')).toBeTruthy();
		expect(screen.getByTestId('feed-heading').textContent).toBe('Search: "nonexistent-query"');
		expect(screen.getByTestId('empty-feed-title').textContent).toBe(
			"No results for 'nonexistent-query'",
		);
		expect(screen.getByTestId('browse-featured-link')).toBeTruthy();
	});

	test('renders FeedErrorPage with retry button that calls reset()', async () => {
		const reset = vi.fn();
		renderInTestRouter(<FeedErrorPage reset={reset} />);

		expect(await screen.findByTestId('feed-error-heading')).toBeTruthy();
		expect(screen.getByTestId('feed-error-heading').textContent).toBe('Feed unavailable');
		const retryBtn = screen.getByTestId('retry-feed-button');
		fireEvent.click(retryBtn);
		expect(reset).toHaveBeenCalledTimes(1);
	});
});

describe('Category Feed Route (CategoryPage & CategoryErrorPage)', () => {
	test('renders category feed requests with category title and description', async () => {
		vi.mocked(getCategoriesFn).mockResolvedValue({
			items: [
				{
					id: 4,
					name: 'Healthcare',
					slug: 'healthcare',
					retiredAt: null,
				},
			],
		} as never);
		vi.mocked(getAuthUserFn).mockResolvedValue({ user: null, profile: null } as never);
		vi.mocked(getCategoryFeedFn).mockResolvedValue({
			category: {
				id: 4,
				name: 'Healthcare',
				slug: 'healthcare',
				description: 'Medical support, first aid equipment, and wellness.',
			},
			items: [
				{
					id: 'req-2',
					title: 'Wheelchair needed for elderly neighbor',
					goal: 'A neighbor needs a foldable wheelchair for hospital visits.',
					state: 'published',
					voteCount: 22,
					modality: 'in_person',
					location: 'Surulere',
					category: { id: 4, name: 'Healthcare', slug: 'healthcare' },
				},
			],
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
		} as never);

		renderAppRoute('/categories/healthcare');

		expect(await screen.findByTestId('category-title')).toBeTruthy();
		expect(screen.getByTestId('category-title').textContent).toBe('Healthcare');
		expect(screen.getByTestId('category-description').textContent).toContain('Medical support');
		expect(screen.getByText('Wheelchair needed for elderly neighbor')).toBeTruthy();
		expect(screen.getByText('22 votes')).toBeTruthy();
	});

	test('renders empty category state with CTA when no requests exist', async () => {
		vi.mocked(getCategoriesFn).mockResolvedValue({ items: [] } as never);
		vi.mocked(getAuthUserFn).mockResolvedValue({ user: null, profile: null } as never);
		vi.mocked(getCategoryFeedFn).mockResolvedValue({
			category: {
				id: 5,
				name: 'Legal Aid',
				slug: 'legal-aid',
				description: 'Free legal counseling and document verification.',
			},
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		} as never);

		renderAppRoute('/categories/legal-aid');

		expect(await screen.findByTestId('category-title')).toBeTruthy();
		expect(screen.getByTestId('category-title').textContent).toBe('Legal Aid');
		expect(screen.getByTestId('empty-feed')).toBeTruthy();
		expect(screen.getByTestId('empty-feed-title').textContent).toBe('No requests yet');
		expect(screen.getByTestId('create-request-cta')).toBeTruthy();
	});

	test('renders CategoryErrorPage with retry button that calls reset()', async () => {
		const reset = vi.fn();
		renderInTestRouter(<CategoryErrorPage reset={reset} />);

		expect(await screen.findByTestId('category-error-heading')).toBeTruthy();
		expect(screen.getByTestId('category-error-heading').textContent).toBe(
			'Category feed unavailable',
		);
		const retryBtn = screen.getByTestId('retry-category-button');
		fireEvent.click(retryBtn);
		expect(reset).toHaveBeenCalledTimes(1);
	});
});
