import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/categories/$categorySlug')({
	component: CategoryPage,
});

function CategoryPage() {
	const { categorySlug } = Route.useParams();
	return (
		<section>
			<h1>Category: {categorySlug}</h1>
			<p>No requests in this category yet.</p>
			<Link to="/">Back to the feed</Link>
		</section>
	);
}
