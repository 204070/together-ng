import { createFileRoute, Link } from '@tanstack/react-router';
import { getRequestDetailFn } from '../../lib/server';

export const Route = createFileRoute('/requests/$requestId')({
	loader: ({ params }) => getRequestDetailFn({ data: params.requestId }),
	component: RequestDetailPage,
});

function RequestDetailPage() {
	const { request } = Route.useLoaderData();
	if (request === null) {
		return (
			<section>
				<h1>Request not found</h1>
				<p>This request does not exist or you cannot view it.</p>
				<Link to="/">Back to the feed</Link>
			</section>
		);
	}
	return (
		<section>
			<h1>{request.title}</h1>
			<p>{request.goal}</p>
		</section>
	);
}
