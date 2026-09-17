export function FeedSkeleton({ count = 3 }: { count?: number }) {
	const items = Array.from({ length: count }, (_, i) => i);

	return (
		<div
			className="feed-skeleton-list grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
			data-testid="feed-skeleton"
			role="status"
			aria-label="Loading requests..."
		>
			{items.map((i) => (
				<div
					key={i}
					className="border rounded-lg p-4 shadow-sm bg-white animate-pulse flex flex-col justify-between gap-3 min-h-[160px]"
					data-testid="feed-skeleton-card"
				>
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-2">
							<div className="h-4 bg-gray-200 rounded w-20" />
							<div className="h-4 bg-gray-200 rounded w-16" />
							<div className="h-4 bg-gray-200 rounded w-16" />
						</div>
						<div className="h-6 bg-gray-200 rounded w-3/4 mt-1" />
						<div className="h-4 bg-gray-200 rounded w-full mt-2" />
						<div className="h-4 bg-gray-200 rounded w-5/6" />
					</div>
					<div className="flex items-center justify-between pt-2 border-t">
						<div className="h-4 bg-gray-200 rounded w-12" />
						<div className="h-4 bg-gray-200 rounded w-16" />
					</div>
				</div>
			))}
		</div>
	);
}
