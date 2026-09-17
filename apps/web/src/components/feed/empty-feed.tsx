import { Link } from '@tanstack/react-router';

export interface EmptyFeedProps {
	type?: 'search' | 'category' | 'feed';
	query?: string;
	categoryName?: string;
	categorySlug?: string;
	onReset?: () => void;
}

export function EmptyFeed({
	type = 'feed',
	query,
	categoryName,
	categorySlug,
	onReset,
}: EmptyFeedProps) {
	if (type === 'search' || (query !== undefined && query.trim() !== '')) {
		const trimmedQuery = query?.trim() ?? '';
		return (
			<div
				className="empty-feed-search text-center py-12 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center gap-3"
				data-testid="empty-feed"
				data-empty-type="search"
			>
				<div className="text-gray-400 text-4xl mb-1" aria-hidden="true">
					🔍
				</div>
				<h2 className="text-lg font-semibold text-gray-900" data-testid="empty-feed-title">
					No results for &apos;{trimmedQuery}&apos;
				</h2>
				<p className="text-sm text-gray-600 max-w-md">
					We couldn&apos;t find any requests matching your search. Try checking for typos, using
					broader terms, or clearing active filters.
				</p>
				<div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
					{onReset ? (
						<button
							type="button"
							onClick={onReset}
							className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
							data-testid="reset-search-button"
						>
							Clear search
						</button>
					) : null}
					<Link
						to="/"
						search={{}}
						className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
						data-testid="browse-featured-link"
					>
						Browse featured requests
					</Link>
				</div>
			</div>
		);
	}

	if (type === 'category' || categorySlug) {
		const label = categoryName ? ` in ${categoryName}` : '';
		return (
			<div
				className="empty-feed-category text-center py-12 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center gap-3"
				data-testid="empty-feed"
				data-empty-type="category"
			>
				<div className="text-gray-400 text-4xl mb-1" aria-hidden="true">
					📋
				</div>
				<h2 className="text-lg font-semibold text-gray-900" data-testid="empty-feed-title">
					No requests yet
				</h2>
				<p className="text-sm text-gray-600 max-w-md">
					There are no active requests{label} at the moment. Be the first to ask for help in this
					category!
				</p>
				<div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
					<Link
						to="/requests/new"
						className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
						data-testid="create-request-cta"
					>
						Ask for help
					</Link>
					<Link
						to="/"
						search={{}}
						className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
						data-testid="browse-all-link"
					>
						Browse all requests
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div
			className="empty-feed-default text-center py-12 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center gap-3"
			data-testid="empty-feed"
			data-empty-type="feed"
		>
			<div className="text-gray-400 text-4xl mb-1" aria-hidden="true">
				🤝
			</div>
			<h2 className="text-lg font-semibold text-gray-900" data-testid="empty-feed-title">
				No requests yet
			</h2>
			<p className="text-sm text-gray-600 max-w-md">
				No published requests match your current criteria. Ask for help or adjust your filters to
				see other requests.
			</p>
			<div className="flex items-center gap-3 mt-2 flex-wrap justify-center">
				<Link
					to="/requests/new"
					className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
					data-testid="create-request-cta"
				>
					Ask for help
				</Link>
				<Link
					to="/"
					search={{}}
					className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
					data-testid="browse-all-link"
				>
					Browse all requests
				</Link>
			</div>
		</div>
	);
}
