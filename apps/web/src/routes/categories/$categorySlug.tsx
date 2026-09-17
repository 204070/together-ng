import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { EmptyFeed } from '../../components/feed/empty-feed';
import { FeedFilters } from '../../components/feed/feed-filters';
import { FeedSkeleton } from '../../components/feed/feed-skeleton';
import { RequestCard } from '../../components/feed/request-card';
import {
	type FeedFilterParams,
	getAuthUserFn,
	getCategoriesFn,
	getCategoryFeedFn,
} from '../../lib/server';

export interface CategorySearchParams extends FeedFilterParams {}

export const Route = createFileRoute('/categories/$categorySlug')({
	validateSearch: (search: Record<string, unknown>): CategorySearchParams => ({
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
	loader: async ({ params, deps }) => {
		const [categoryFeed, categoriesRes, me] = await Promise.all([
			getCategoryFeedFn({
				data: {
					slug: params.categorySlug,
					location: deps.location,
					modality: deps.modality,
					online: deps.online,
					helpType: deps.helpType,
					sort: deps.sort,
					page: deps.page,
					limit: deps.limit,
				},
			}).catch(() => null),
			getCategoriesFn().catch(() => ({ items: [] })),
			getAuthUserFn().catch(() => ({ user: null, profile: null })),
		]);

		return {
			categoryFeed,
			categories: categoriesRes?.items ?? [],
			me,
			slug: params.categorySlug,
			searchParams: deps,
		};
	},
	pendingComponent: () => (
		<div className="py-6">
			<FeedSkeleton count={6} />
		</div>
	),
	errorComponent: CategoryErrorPage,
	component: CategoryPage,
});

export function CategoryPage() {
	const { categoryFeed, categories, slug, searchParams } = Route.useLoaderData();
	const navigate = useNavigate();

	if (!categoryFeed || categoryFeed.error === 'CATEGORY_NOT_FOUND') {
		return (
			<section
				className="category-not-found max-w-4xl mx-auto px-4 py-12 text-center flex flex-col items-center justify-center gap-3"
				data-testid="category-not-found"
			>
				<h1 className="text-2xl font-bold text-gray-900">Category not found</h1>
				<p className="text-sm text-gray-600">
					The category &quot;{slug}&quot; could not be found or does not exist.
				</p>
				<Link
					to="/"
					search={{}}
					className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
				>
					Back to all requests
				</Link>
			</section>
		);
	}

	if (categoryFeed.error === 'CATEGORY_RETIRED') {
		return (
			<section
				className="category-retired max-w-4xl mx-auto px-4 py-12 text-center flex flex-col items-center justify-center gap-3"
				data-testid="category-retired"
			>
				<h1 className="text-2xl font-bold text-gray-900">Category retired</h1>
				<p className="text-sm text-gray-600">
					The category &quot;{categoryFeed.category?.name ?? slug}&quot; has been retired and is no
					longer active.
				</p>
				<Link
					to="/"
					search={{}}
					className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
				>
					Back to all requests
				</Link>
			</section>
		);
	}

	const category = categoryFeed.category;

	return (
		<section className="category-feed-page max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
				<div>
					<div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
						<Link to="/" search={{}} className="hover:underline">
							Requests
						</Link>
						<span>&rsaquo;</span>
						<span className="font-medium text-gray-700">{category?.name ?? slug}</span>
					</div>
					<h1 className="text-2xl font-bold text-gray-900" data-testid="category-title">
						{category?.name ?? slug}
					</h1>
					{category?.description ? (
						<p
							className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed"
							data-testid="category-description"
						>
							{category.description}
						</p>
					) : null}
				</div>
				<Link
					to="/requests/new"
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md shadow-sm transition-colors"
					data-testid="ask-for-help-cta"
				>
					Ask for help
				</Link>
			</div>

			<FeedFilters
				categories={categories}
				currentFilters={{
					category: slug,
					location: searchParams.location,
					modality: searchParams.modality,
					helpType: searchParams.helpType,
					sort: searchParams.sort,
				}}
				hideCategory={true}
			/>

			<div data-testid="category-feed-content">
				{categoryFeed.items.length === 0 ? (
					<EmptyFeed
						type="category"
						categoryName={category?.name}
						categorySlug={category?.slug ?? slug}
					/>
				) : (
					<div
						className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
						data-testid="category-feed-grid"
					>
						{categoryFeed.items.map((item) => (
							<RequestCard key={item.id} request={item} />
						))}
					</div>
				)}
			</div>

			{categoryFeed.pagination && categoryFeed.pagination.totalPages > 1 ? (
				<nav
					aria-label="Category pagination"
					className="flex items-center justify-between pt-4 border-t border-gray-200 mt-2 flex-wrap gap-3"
					data-testid="pagination-nav"
				>
					<span className="text-xs text-gray-500" data-testid="pagination-info">
						Page {categoryFeed.pagination.page} of {categoryFeed.pagination.totalPages} (
						{categoryFeed.pagination.total} total)
					</span>
					<div className="flex items-center gap-2">
						{categoryFeed.pagination.page > 1 ? (
							<button
								type="button"
								onClick={() =>
									navigate({
										search: (prev: Record<string, unknown>) => ({
											...prev,
											page: Math.max(1, (categoryFeed.pagination.page ?? 1) - 1),
										}),
									})
								}
								className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
								data-testid="prev-page-button"
							>
								Previous
							</button>
						) : null}
						{categoryFeed.pagination.page < categoryFeed.pagination.totalPages ? (
							<button
								type="button"
								onClick={() =>
									navigate({
										search: (prev: Record<string, unknown>) => ({
											...prev,
											page: (categoryFeed.pagination.page ?? 1) + 1,
										}),
									})
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

export function CategoryErrorPage({ reset }: { reset: () => void }) {
	return (
		<section
			className="category-error-container text-center py-12 px-4 max-w-lg mx-auto bg-white rounded-lg border border-red-200 shadow-sm flex flex-col items-center justify-center gap-3 my-8"
			data-testid="category-error"
		>
			<div className="text-red-500 text-3xl" aria-hidden="true">
				⚠️
			</div>
			<h1 className="text-lg font-bold text-gray-900" data-testid="category-error-heading">
				Category feed unavailable
			</h1>
			<p className="text-sm text-gray-600">
				The requests for this category could not be loaded. Please try again.
			</p>
			<div className="flex items-center gap-3 mt-2">
				<button
					type="button"
					onClick={() => reset()}
					className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
					data-testid="retry-category-button"
				>
					Retry
				</button>
				<Link
					to="/"
					search={{}}
					className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					Browse all requests
				</Link>
			</div>
		</section>
	);
}
