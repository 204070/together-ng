import { createFileRoute, Link } from '@tanstack/react-router';
import { getRequestDetailFn } from '../../lib/server';

export const Route = createFileRoute('/requests/$requestId')({
	loader: ({ params }) => getRequestDetailFn({ data: params.requestId }),
	head: ({ loaderData, params }) => {
		const request = loaderData?.request;
		if (!request) {
			return {
				meta: [{ title: 'Request not found | Together' }, { name: 'robots', content: 'noindex' }],
			};
		}
		const title = `${request.title} | Together`;
		const description = request.goal && request.goal.trim() !== '' ? request.goal : request.title;
		const url = `/requests/${params.requestId}`;
		const imageUrl = `/api/requests/${params.requestId}/card.png`;
		return {
			meta: [
				{ title },
				{ name: 'description', content: description },
				{ property: 'og:title', content: request.title },
				{ property: 'og:description', content: description },
				{ property: 'og:type', content: 'website' },
				{ property: 'og:url', content: url },
				{ property: 'og:image', content: imageUrl },
				{ property: 'og:image:width', content: '1200' },
				{ property: 'og:image:height', content: '630' },
				{ property: 'og:image:alt', content: request.title },
				{ name: 'twitter:card', content: 'summary_large_image' },
				{ name: 'twitter:title', content: request.title },
				{ name: 'twitter:description', content: description },
				{ name: 'twitter:image', content: imageUrl },
			],
		};
	},
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
