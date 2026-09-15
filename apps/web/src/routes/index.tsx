import { createFileRoute, Link } from '@tanstack/react-router';
import { getAuthUserFn, getFeaturedFn } from '../lib/server';

export const Route = createFileRoute('/')({
	loader: async () => {
		const [feed, me] = await Promise.all([getFeaturedFn(), getAuthUserFn()]);
		return { feed, me };
	},
	errorComponent: FeedErrorPage,
	component: HomePage,
});

function HomePage() {
	const { feed, me } = Route.useLoaderData();
	const greeting = me.profile?.name ?? me.user?.email ?? null;
	return (
		<section>
			<h1>Requests</h1>
			{greeting ? <p>Welcome back, {greeting}</p> : null}
			<div data-testid="feed" id="feed">
				{feed.items.length === 0 ? (
					<p>No published requests yet.</p>
				) : (
					<ul>
						{feed.items.map((item) => (
							<li key={item.id}>
								<Link to="/requests/$requestId" params={{ requestId: item.id }}>
									{item.title}
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}

function FeedErrorPage({ reset }: { reset: () => void }) {
	return (
		<section>
			<h1>Feed unavailable</h1>
			<p>The feed could not be loaded. Check that the API is running and try again.</p>
			<button type="button" onClick={() => reset()}>
				Retry
			</button>{' '}
			<Link to="/" reloadDocument>
				Reload the feed
			</Link>
		</section>
	);
}
