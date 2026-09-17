import { useNavigate } from '@tanstack/react-router';

export interface CategoryOption {
	id: number;
	name: string;
	slug: string;
	retiredAt?: string | null;
}

export interface FilterState {
	category?: string;
	location?: string;
	modality?: string;
	helpType?: string;
	sort?: string;
	q?: string;
}

export interface FeedFiltersProps {
	categories?: CategoryOption[];
	currentFilters: FilterState;
	onFilterChange?: (newFilters: FilterState) => void;
	hideCategory?: boolean;
	isSearch?: boolean;
}

export function FeedFilters({
	categories = [],
	currentFilters,
	onFilterChange,
	hideCategory = false,
	isSearch = false,
}: FeedFiltersProps) {
	const navigate = useNavigate();

	const activeCategories = categories.filter((c) => !c.retiredAt);

	const updateFilter = (key: keyof FilterState, value: string | undefined) => {
		const next: FilterState = {
			...currentFilters,
			[key]: value && value.trim() !== '' ? value.trim() : undefined,
		};

		if (onFilterChange) {
			onFilterChange(next);
		}

		if (navigate) {
			try {
				navigate({
					search: (prev: Record<string, unknown>) => {
						const updated = { ...prev };
						if (value && value.trim() !== '') {
							updated[key] = value.trim();
						} else {
							delete updated[key];
						}
						// Reset to page 1 when changing filters
						delete updated.page;
						return updated;
					},
				} as never);
			} catch {
				// Outside router context (e.g. isolated component unit tests)
			}
		}
	};

	const handleReset = () => {
		const resetState: FilterState = {
			q: currentFilters.q,
			sort: isSearch ? 'relevance' : 'most_supported',
		};

		if (onFilterChange) {
			onFilterChange(resetState);
		}

		if (navigate) {
			try {
				navigate({
					search: (prev: Record<string, unknown>) => {
						const updated: Record<string, unknown> = {};
						if (prev.q) updated.q = prev.q;
						return updated;
					},
				} as never);
			} catch {
				// Outside router context (e.g. isolated component unit tests)
			}
		}
	};

	const hasActiveFilters = Boolean(
		(!hideCategory && currentFilters.category) ||
			currentFilters.location ||
			currentFilters.modality ||
			currentFilters.helpType ||
			(currentFilters.sort && currentFilters.sort !== (isSearch ? 'relevance' : 'most_supported')),
	);

	return (
		<div
			className="feed-filters bg-white border rounded-lg p-4 shadow-sm flex flex-col gap-4"
			data-testid="feed-filters"
		>
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
				{!hideCategory ? (
					<div className="flex flex-col gap-1">
						<label htmlFor="filter-category-select" className="text-xs font-semibold text-gray-700">
							Category
						</label>
						<select
							id="filter-category-select"
							data-testid="filter-category"
							aria-label="Category"
							value={currentFilters.category ?? ''}
							onChange={(e) => updateFilter('category', e.target.value)}
							className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">All categories</option>
							{activeCategories.map((c) => (
								<option key={c.id} value={c.slug}>
									{c.name}
								</option>
							))}
						</select>
					</div>
				) : null}

				<div className="flex flex-col gap-1">
					<label htmlFor="filter-modality-select" className="text-xs font-semibold text-gray-700">
						Modality
					</label>
					<select
						id="filter-modality-select"
						data-testid="filter-modality"
						aria-label="Modality"
						value={currentFilters.modality ?? ''}
						onChange={(e) => updateFilter('modality', e.target.value)}
						className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">Any modality</option>
						<option value="online">Online</option>
						<option value="in_person">In person</option>
						<option value="both">Online or In person</option>
					</select>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="filter-help-type-select" className="text-xs font-semibold text-gray-700">
						Type of help
					</label>
					<select
						id="filter-help-type-select"
						data-testid="filter-help-type"
						aria-label="Type of help"
						value={currentFilters.helpType ?? ''}
						onChange={(e) => updateFilter('helpType', e.target.value)}
						className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">All types</option>
						<option value="borrow">Borrow item</option>
						<option value="receive">Receive goods</option>
						<option value="access">Access resource</option>
						<option value="learn">Learn skill</option>
						<option value="collaborate">Collaborate</option>
					</select>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="filter-location-input" className="text-xs font-semibold text-gray-700">
						Location
					</label>
					<input
						id="filter-location-input"
						data-testid="filter-location"
						aria-label="Location"
						type="text"
						value={currentFilters.location ?? ''}
						onChange={(e) => updateFilter('location', e.target.value)}
						placeholder="e.g. Lagos, Abuja"
						className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="filter-sort-select" className="text-xs font-semibold text-gray-700">
						Sort by
					</label>
					<select
						id="filter-sort-select"
						data-testid="filter-sort"
						aria-label="Sort by"
						value={currentFilters.sort ?? (isSearch ? 'relevance' : 'most_supported')}
						onChange={(e) => updateFilter('sort', e.target.value)}
						className="text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{isSearch ? <option value="relevance">Relevance</option> : null}
						<option value="most_supported">Most supported</option>
						<option value="newest">Newest</option>
						<option value="still_open">Still open</option>
					</select>
				</div>
			</div>

			{hasActiveFilters ? (
				<div className="flex items-center justify-end pt-2 border-t border-gray-100">
					<button
						type="button"
						onClick={handleReset}
						data-testid="clear-filters-button"
						className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
					>
						Reset filters
					</button>
				</div>
			) : null}
		</div>
	);
}
