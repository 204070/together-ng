import { useMemo, useState } from 'react';
import type { Category } from './types';

export function CategoryStep({
	categories,
	selectedCategoryId,
	onSelect,
	error,
	retryLoad,
}: {
	categories: Category[] | null;
	selectedCategoryId: number | null;
	onSelect: (id: number) => void;
	error: string | null;
	retryLoad: () => void;
}) {
	const [search, setSearch] = useState('');

	const filtered = useMemo(() => {
		if (!categories) return [];
		if (!search.trim()) return categories;
		const q = search.trim().toLowerCase();
		return categories.filter(
			(c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q),
		);
	}, [categories, search]);

	const showSearch = categories !== null && categories.length > 10;
	const noMatch = search.trim() !== '' && filtered.length === 0;
	const selectedCategory = categories?.find((c) => c.id === selectedCategoryId);
	const isRetired = selectedCategory?.retiredAt !== null;

	if (error) {
		return (
			<section>
				<h2>Choose a category</h2>
				<p role="alert">{error}</p>
				<button type="button" onClick={retryLoad}>
					Retry
				</button>
			</section>
		);
	}

	if (!categories) {
		return (
			<section>
				<h2>Choose a category</h2>
				<p>Loading categories...</p>
			</section>
		);
	}

	return (
		<section>
			<h2>Choose a category</h2>
			<p className="helper-text">
				A specific request is more likely to receive useful responses. Choose the category that best
				fits your request.
			</p>
			{showSearch && (
				<div>
					<label htmlFor="category-search">Search categories</label>
					<input
						id="category-search"
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Filter categories..."
					/>
				</div>
			)}
			{isRetired && (
				<p role="alert" className="warning">
					Selected category is no longer available — please choose another
				</p>
			)}
			{noMatch && <p role="status">No categories match &lsquo;{search}&rsquo;</p>}
			<ul>
				{filtered.map((category) => (
					<li key={category.id}>
						<button
							type="button"
							onClick={() => onSelect(category.id)}
							aria-pressed={category.id === selectedCategoryId}
						>
							{category.name}
						</button>
						{category.description && (
							<span className="category-description">{category.description}</span>
						)}
					</li>
				))}
			</ul>
		</section>
	);
}
