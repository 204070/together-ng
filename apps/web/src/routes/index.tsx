import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { EmptyFeed } from '../components/feed/empty-feed';
import { FeedFilters } from '../components/feed/feed-filters';
import { FeedSkeleton } from '../components/feed/feed-skeleton';
import { RequestCard } from '../components/feed/request-card';
import {
	type FeedFilterParams,
	getAuthUserFn,
	getCategoriesFn,
	getFeaturedFn,
	searchRequestsFn,
} from '../lib/server';

export interface FeedSearchParams extends FeedFilterParams {
	q?: string;
}

export const Route = createFileRoute('/')({
	validateSearch: (search: Record<string, unknown>): FeedSearchParams => ({
		q: typeof search.q === 'string' ? search.q : undefined,
		category: typeof search.category === 'string' ? search.category : undefined,
		categoryId: typeof search.categoryId === 'string' ? search.categoryId : undefined,
		location: typeof search.location === 'string' ? search.location : undefined,
		modality: typeof search.modality === 'string' ? search.modality : undefined,
		online: typeof search.online === 'string' ? search.online : undefined,
		helpType: typeof search.helpType === 'string' ? search.helpType : undefined,
		sort: typeof search.sort === 'string' ? search.sort : undefined,
		page:
			typeof search.page === 'number'
				? search.page
				: typeof search.page === 'string'
					? Number(search.page) || 1
					: 1,
		limit:
			typeof search.limit === 'number'
				? search.limit
				: typeof search.limit === 'string'
					? Number(search.limit) || 20
					: 20,
	}),
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		const searchParams = deps;
		const isSearch = Boolean(searchParams.q && searchParams.q.trim() !== '');

		const [categoriesRes, meRes, feedRes] = await Promise.all([
			getCategoriesFn().catch(() => ({ items: [] })),
			getAuthUserFn().catch(() => ({ user: null, profile: null })),
			isSearch
				? searchRequestsFn({
						data: {
							q: searchParams.q?.trim() ?? '',
							category: searchParams.category,
							categoryId: searchParams.categoryId,
							location: searchParams.location,
							modality: searchParams.modality,
							online: searchParams.online,
							helpType: searchParams.helpType,
							sort: searchParams.sort,
							page: searchParams.page,
							limit: searchParams.limit,
						},
					})
				: getFeaturedFn({
						data: {
							category: searchParams.category,
							categoryId: searchParams.categoryId,
							location: searchParams.location,
							modality: searchParams.modality,
							online: searchParams.online,
							helpType: searchParams.helpType,
							sort: searchParams.sort,
							page: searchParams.page,
							limit: searchParams.limit,
						},
					}),
		]);

		return {
			feed: feedRes,
			categories: categoriesRes.items ?? [],
			me: meRes,
			searchParams,
		};
	},
	pendingComponent: () => (
		<div className="py-6">
			<FeedSkeleton count={6} />
		</div>
	),
	errorComponent: FeedErrorPage,
	component: HomePage,
});

export function HomePage() {
	const { feed, categories, me, searchParams } = Route.useLoaderData();
	const navigate = useNavigate();
	const [queryInput, setQueryInput] = useState(searchParams.q ?? '');

	const greeting = me.profile?.name ?? me.user?.email ?? null;
	const isSearchActive = Boolean(searchParams.q && searchParams.q.trim() !== '');

	const handleSearchSubmit = (e: FormEvent) => {
		e.preventDefault();
		navigate({
			search: (prev: Record<string, unknown>) => {
				const next: Record<string, unknown> = { ...prev };
				if (queryInput.trim() !== '') {
					next.q = queryInput.trim();
				} else {
					delete next.q;
				}
				delete next.page;
				return next;
			},
		} as never);
	};

	const handleClearSearch = () => {
		setQueryInput('');
		navigate({
			search: (prev: Record<string, unknown>) => {
				const next = { ...prev };
				delete next.q;
				delete next.page;
				return next;
			},
		} as never);
	};

	return (
		<section className="feed-page max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900" data-testid="feed-heading">
						{isSearchActive ? `Search: "${searchParams.q}"` : 'Requests'}
					</h1>
					{greeting ? (
						<p className="text-sm text-gray-600 mt-0.5" data-testid="user-greeting">
							Welcome back, {greeting}
						</p>
					) : (
						<p className="text-sm text-gray-600 mt-0.5">
							Discover requests from the community and offer your support.
						</p>
					)}
				</div>
				<Link
					to="/requests/new"
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm transition-colors"
					data-testid="create-request-button"
				>
					Ask for help
				</Link>
			</div>

			<form
				onSubmit={handleSearchSubmit}
				className="flex items-center gap-2"
				data-testid="search-form"
			>
				<div className="relative flex-1">
					<input
						type="search"
						name="q"
						value={queryInput}
						onChange={(e) => setQueryInput(e.target.value)}
						placeholder="Search requests (e.g. laptop, mentor, ride)..."
						className="w-full px-3.5 py-2 pl-9 text-sm border border-gray-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						data-testid="search-input"
						aria-label="Search requests"
					/>
					<span
						className="absolute left-3 top-2.5 text-gray-400 text-sm pointer-events-none"
						aria-hidden="true"
					>
						🔍
					</span>
				</div>
				<button
					type="submit"
					className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
					data-testid="search-button"
				>
					Search
				</button>
				{isSearchActive ? (
					<button
						type="button"
						onClick={handleClearSearch}
						className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
						data-testid="clear-search-button"
					>
						Clear
					</button>
				) : null}
			</form>

			<FeedFilters
				categories={categories}
				currentFilters={{
					category: searchParams.category,
					location: searchParams.location,
					modality: searchParams.modality,
					helpType: searchParams.helpType,
					sort: searchParams.sort,
					q: searchParams.q,
				}}
				isSearch={isSearchActive}
			/>

			<div data-testid="feed" id="feed">
				{feed.items.length === 0 ? (
					<EmptyFeed
						type={isSearchActive ? 'search' : 'feed'}
						query={searchParams.q}
						onReset={handleClearSearch}
					/>
				) : (
					<div
						className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
						data-testid="feed-grid"
					>
						{feed.items.map((item) => (
							<RequestCard key={item.id} request={item} />
						))}
					</div>
				)}
			</div>

			{feed.pagination && feed.pagination.totalPages > 1 ? (
				<nav
					aria-label="Feed pagination"
					className="flex items-center justify-between pt-4 border-t border-gray-200 mt-2 flex-wrap gap-3"
					data-testid="pagination-nav"
				>
					<span className="text-xs text-gray-500" data-testid="pagination-info">
						Page {feed.pagination.page} of {feed.pagination.totalPages} ({feed.pagination.total}{' '}
						total)
					</span>
					<div className="flex items-center gap-2">
						{feed.pagination.page > 1 ? (
							<button
								type="button"
								onClick={() =>
									navigate({
										search: (prev: Record<string, unknown>) => ({
											...prev,
											page: Math.max(1, (feed.pagination.page ?? 1) - 1),
										}),
									} as never)
								}
								className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
								data-testid="prev-page-button"
							>
								Previous
							</button>
						) : null}
						{feed.pagination.page < feed.pagination.totalPages ? (
							<button
								type="button"
								onClick={() =>
									navigate({
										search: (prev: Record<string, unknown>) => ({
											...prev,
											page: (feed.pagination.page ?? 1) + 1,
										}),
									} as never)
								}
								className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
								data-testid="load-more-button"
							>
								Load more
							</button>
						) : null}
					</div>
				</nav>
			) : null}
		</section>
	);
}

export function FeedErrorPage({ reset }: { reset: () => void }) {
	return (
		<section
			className="feed-error-container text-center py-12 px-4 max-w-lg mx-auto bg-white rounded-lg border border-red-200 shadow-sm flex flex-col items-center justify-center gap-3 my-8"
			data-testid="feed-error"
		>
			<div className="text-red-500 text-3xl" aria-hidden="true">
				⚠️
			</div>
			<h1 className="text-lg font-bold text-gray-900" data-testid="feed-error-heading">
				Feed unavailable
			</h1>
			<p className="text-sm text-gray-600">
				The feed could not be loaded. Check that the API is running and try again.
			</p>
			<div className="flex items-center gap-3 mt-2">
				<button
					type="button"
					onClick={() => reset()}
					className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
					data-testid="retry-feed-button"
				>
					Retry
				</button>
				<Link
					to="/"
					reloadDocument
					search={{}}
					className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
					data-testid="reload-feed-link"
				>
					Reload the feed
				</Link>
			</div>
		</section>
	);
}
