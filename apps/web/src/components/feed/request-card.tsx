import { Link } from '@tanstack/react-router';

export interface FeedItem {
	id: string;
	title: string;
	goal?: string | null;
	barrier?: string | null;
	helpNeeded?: string | null;
	state: string;
	modality?: string | null;
	helpType?: string | null;
	location?: string | null;
	voteCount?: number;
	createdAt?: string;
	publishedAt?: string | null;
	category?: {
		id: number;
		name: string;
		slug: string;
	} | null;
}

export function formatStateBadge(state: string): string {
	switch (state) {
		case 'published':
			return 'Published';
		case 'receiving_responses':
			return 'Receiving Responses';
		case 'help_arranged':
			return 'Help Arranged';
		case 'in_progress':
			return 'In Progress';
		case 'completed':
			return 'Completed';
		case 'closed':
			return 'Closed';
		case 'cancelled':
			return 'Cancelled';
		case 'archived':
			return 'Archived';
		case 'draft':
			return 'Draft';
		case 'under_review':
			return 'Under Review';
		default:
			return state;
	}
}

export function formatLocationOrModality(request: {
	modality?: string | null;
	location?: string | null;
}): string {
	if (request.modality === 'online') {
		return 'Online';
	}
	if (request.location?.trim()) {
		return request.location.trim();
	}
	if (request.modality === 'in_person') {
		return 'In person';
	}
	if (request.modality === 'both') {
		return 'Online / In person';
	}
	return 'Online';
}

export function RequestCard({ request }: { request: FeedItem }) {
	const snippet = request.goal?.trim()
		? request.goal.length > 160
			? `${request.goal.slice(0, 157)}...`
			: request.goal
		: request.helpNeeded?.trim()
			? request.helpNeeded.length > 160
				? `${request.helpNeeded.slice(0, 157)}...`
				: request.helpNeeded
			: '';

	const locationLabel = formatLocationOrModality(request);
	const stateLabel = formatStateBadge(request.state);

	return (
		<article
			className="request-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col justify-between gap-3"
			data-testid="request-card"
			data-request-id={request.id}
		>
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2 flex-wrap text-xs text-gray-500">
					{request.category ? (
						<span
							className="category-badge bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded"
							data-testid="category-badge"
						>
							{request.category.name}
						</span>
					) : null}
					<span className="location-badge font-medium text-gray-600" data-testid="location-badge">
						{locationLabel}
					</span>
					<span
						className="state-badge px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700"
						data-testid="state-badge"
						data-state={request.state}
					>
						{stateLabel}
					</span>
				</div>

				<h2 className="text-lg font-semibold text-gray-900 leading-snug">
					<Link
						to="/requests/$requestId"
						params={{ requestId: request.id }}
						className="hover:underline text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
						data-testid="request-title-link"
					>
						{request.title}
					</Link>
				</h2>

				{snippet ? (
					<p
						className="text-sm text-gray-600 line-clamp-3 leading-relaxed"
						data-testid="request-snippet"
					>
						{snippet}
					</p>
				) : null}
			</div>

			<div className="flex items-center justify-between pt-2 border-t text-xs text-gray-500">
				<span className="vote-count-badge font-medium" data-testid="vote-count">
					{request.voteCount ?? 0} {request.voteCount === 1 ? 'vote' : 'votes'}
				</span>
				<Link
					to="/requests/$requestId"
					params={{ requestId: request.id }}
					className="text-blue-600 hover:underline font-medium text-xs"
					data-testid="view-details-link"
				>
					View request &rarr;
				</Link>
			</div>
		</article>
	);
}
