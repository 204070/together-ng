import { createFileRoute, Link } from '@tanstack/react-router';
import { formatStateBadge } from '../../components/feed/request-card';
import {
	buildShareText,
	canonicalUrlFor,
	cardImageUrlFor,
	resolveDetailView,
	shareContentFor,
} from '../../components/share';
import { ShareButton } from '../../components/share/share-button';
import { VoteButton } from '../../components/vote/vote-button';
import { getAuthUserFn, getCategoriesFn, getRequestDetailFn, getSiteUrlFn } from '../../lib/server';

export const Route = createFileRoute('/requests/$requestId')({
	loader: async ({ params }) => {
		const [detail, auth, site, categories] = await Promise.all([
			getRequestDetailFn({ data: params.requestId }),
			getAuthUserFn(),
			getSiteUrlFn(),
			getCategoriesFn().catch(() => [] as { id: number; name: string; slug: string }[]),
		]);
		const request = detail.request as
			| (Record<string, unknown> & { id: string; title: string; state: string })
			| null;
		const view = resolveDetailView({
			request: request as never,
			viewerUserId: auth?.user?.id,
			authorId: typeof request?.authorId === 'string' ? (request.authorId as string) : null,
		});
		const visible = view.request !== null ? (request as Record<string, unknown>) : null;
		const categoryId = typeof visible?.categoryId === 'number' ? visible.categoryId : null;
		const category =
			categoryId !== null
				? ((categories as { id: number; name: string; slug: string }[]).find(
						(c) => c.id === categoryId,
					) ?? null)
				: null;
		return {
			request: visible,
			ownerOnly: view.request !== null && view.ownerOnly,
			category,
			siteUrl: site.siteUrl as string | undefined,
			auth,
		};
	},
	head: ({ loaderData, params }) => {
		const siteUrl = loaderData?.siteUrl;
		const canonical = canonicalUrlFor('request', params.requestId, siteUrl);
		const image = cardImageUrlFor({ requestId: params.requestId, siteUrl });
		const request = loaderData?.request as { title: string; goal?: unknown } | null;
		if (!request) {
			// Generic fallback metadata: no request title/description leaks here.
			return {
				meta: [
					{ title: 'Request not found | Together' },
					{ name: 'robots', content: 'noindex' },
					{ name: 'description', content: 'This request does not exist or cannot be viewed.' },
					{ property: 'og:title', content: 'Together' },
					{
						property: 'og:description',
						content: 'This request does not exist or cannot be viewed.',
					},
					{ property: 'og:type', content: 'website' },
					{ property: 'og:url', content: canonical },
					{ property: 'og:image', content: image },
					{ property: 'og:image:width', content: '1200' },
					{ property: 'og:image:height', content: '630' },
					{ property: 'og:image:alt', content: 'Together' },
					{ name: 'twitter:card', content: 'summary_large_image' },
					{ name: 'twitter:title', content: 'Together' },
					{
						name: 'twitter:description',
						content: 'This request does not exist or cannot be viewed.',
					},
					{ name: 'twitter:image', content: image },
				],
			};
		}
		const { title, description } = shareContentFor({
			id: params.requestId,
			title: request.title,
			goal: typeof request.goal === 'string' ? request.goal : null,
			state: '',
		});
		return {
			meta: [
				{ title: `${title} | Together` },
				{ name: 'description', content: description },
				{ property: 'og:title', content: title },
				{ property: 'og:description', content: description },
				{ property: 'og:type', content: 'website' },
				{ property: 'og:url', content: canonical },
				{ property: 'og:image', content: image },
				{ property: 'og:image:width', content: '1200' },
				{ property: 'og:image:height', content: '630' },
				{ property: 'og:image:alt', content: title },
				{ name: 'twitter:card', content: 'summary_large_image' },
				{ name: 'twitter:title', content: title },
				{ name: 'twitter:description', content: description },
				{ name: 'twitter:image', content: image },
			],
		};
	},
	component: RequestDetailPage,
});

function RequestDetailPage() {
	const { request, ownerOnly, category, siteUrl, auth } = Route.useLoaderData() as {
		request: Record<string, unknown> | null;
		ownerOnly: boolean;
		category: { id: number; name: string; slug: string } | null;
		siteUrl: string | undefined;
		auth: { user: { id: string } | null };
	};
	if (request === null) {
		return (
			<section>
				<h1>Request not found</h1>
				<p>This request does not exist or you cannot view it.</p>
				<Link to="/">Back to the feed</Link>
			</section>
		);
	}
	const isAuthenticated = auth?.user !== null && auth?.user !== undefined;
	const title = String(request.title ?? '');
	const goal = typeof request.goal === 'string' ? request.goal : '';
	const id = String(request.id ?? '');
	const canonical = canonicalUrlFor('request', id, siteUrl);
	const shareText = buildShareText({
		title,
		goal,
		categoryName: category?.name ?? null,
		url: canonical,
	});
	const state = typeof request.state === 'string' ? request.state : '';
	return (
		<section>
			{ownerOnly ? (
				<p data-testid="state-badge" data-state={state}>
					{formatStateBadge(state)} — only you can see this request in its current state.
				</p>
			) : null}
			{category ? (
				<p data-testid="category-badge">
					<Link to="/categories/$categorySlug" params={{ categorySlug: category.slug }}>
						{category.name}
					</Link>
				</p>
			) : null}
			<h1>{title}</h1>
			<p data-testid="request-goal">{goal}</p>
			<ShareButton title={title} text={shareText} url={canonical} />
			{!isAuthenticated ? (
				<p data-testid="join-cta">
					<Link to="/auth/register" search={{ returnUrl: `/requests/${id}` }}>
						Join Together to help
					</Link>
				</p>
			) : null}
			<VoteButton
				requestId={id}
				initialVoteCount={typeof request.voteCount === 'number' ? request.voteCount : 0}
				initialHasVoted={request.hasVoted === true}
				isAuthenticated={isAuthenticated}
			/>
		</section>
	);
}
