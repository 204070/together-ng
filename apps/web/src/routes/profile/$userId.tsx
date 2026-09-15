import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/profile/$userId')({
	component: ProfilePage,
});

function ProfilePage() {
	const { userId } = Route.useParams();
	return (
		<section>
			<h1>Profile</h1>
			<p>User: {userId}</p>
			<p>Full profiles land in a later issue.</p>
			<Link to="/">Back to the feed</Link>
		</section>
	);
}
