/**
 * Canonical shareable URLs, social-metadata content builders, and detail
 * visibility rules for public Together entities (PRD §65.10).
 *
 * Everything in here is pure (no DOM, no framework) so both the SSR route
 * (`head` + `loader`) and Vitest suites share one source of truth — metadata
 * cannot drift from the page because both are derived from these helpers.
 *
 * No new runtime dependencies: Web Share API + clipboard only (AGENTS.md).
 */

/** Public entity kinds with (current or future) canonical shareable URLs (§65.10.1). */
export type ShareEntityKind = 'request' | 'profile' | 'resource' | 'category' | 'knowledge';

/**
 * Canonical path for a public entity. Requests resolve to the detail route
 * that discovery links to (`/requests/:id`); the other kinds reserve their
 * patterns so a requests-only helper never gets baked in (§65.10.1).
 */
export function canonicalPathFor(kind: ShareEntityKind, id: string): string {
	switch (kind) {
		case 'request':
			return `/requests/${id}`;
		case 'profile':
			return `/profiles/${id}`;
		case 'resource':
			return `/resources/${id}`;
		case 'category':
			return `/categories/${id}`;
		case 'knowledge':
			return `/knowledge/${id}`;
	}
}

/**
 * Absolute canonical URL when the site origin is known (SSR), otherwise the
 * relative canonical path. `siteUrl` must be an origin like
 * `https://together.example` with no trailing slash.
 */
export function canonicalUrlFor(kind: ShareEntityKind, id: string, siteUrl?: string): string {
	const path = canonicalPathFor(kind, id);
	if (!siteUrl) return path;
	return `${siteUrl.replace(/\/+$/, '')}${path}`;
}

/** Path of the generic fallback social card served from web `public/`. */
export const FALLBACK_CARD_PATH = '/images/share-fallback.png';

/**
 * `og:image` for a request page. Until the card pipeline (#33/#34) serves
 * per-request versioned cards, every request resolves to the generic fallback
 * card — always a servable, non-empty URL, never a broken one. Callers pass a
 * `cardVersion` once the pipeline owns versioned URLs
 * (`/social/requests/:id/:version.png` per §65.10.6–§65.10.7).
 */
export function cardImageUrlFor(options: {
	requestId: string;
	siteUrl?: string;
	cardVersion?: string;
}): string {
	const { requestId, siteUrl, cardVersion } = options;
	const prefix = siteUrl ? siteUrl.replace(/\/+$/, '') : '';
	if (cardVersion) return `${prefix}/social/requests/${requestId}/${cardVersion}.png`;
	return `${prefix}${FALLBACK_CARD_PATH}`;
}

export const SHARE_DESCRIPTION_MAX = 200;
export const SHARE_SNIPPET_MAX = 500;

/**
 * Truncate to `max` chars on a word boundary, appending `…` when truncated.
 * Returns '' for blank input so callers can fall back to the title.
 */
export function truncateText(text: string, max: number): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	if (clean.length <= max) return clean;
	const slice = clean.slice(0, max - 1).replace(/\s+\S*$/, '');
	return `${slice.length > 0 ? slice : clean.slice(0, max - 1)}…`;
}

export interface ShareableRequest {
	id: string;
	title: string;
	goal?: string | null;
	state: string;
	categoryId?: number | null;
}

/** Single source of truth for title + goal-summary text (§65.10.2). */
export function shareContentFor(request: ShareableRequest): { title: string; description: string } {
	const title = request.title.trim();
	const goal = request.goal?.trim() ?? '';
	return {
		title,
		description: goal !== '' ? truncateText(goal, SHARE_DESCRIPTION_MAX) : title,
	};
}

/**
 * Share-sheet / clipboard snippet: title + goal summary (first ~200 chars) +
 * category + link, capped at 500 chars total.
 */
export function buildShareText(options: {
	title: string;
	goal?: string | null;
	categoryName?: string | null;
	url: string;
}): string {
	const { title, goal, categoryName, url } = options;
	const parts = [title.trim()];
	const goalSummary = truncateText(goal?.trim() ? (goal as string) : '', SHARE_DESCRIPTION_MAX);
	if (goalSummary !== '') parts.push(goalSummary);
	const category = categoryName?.trim() ? (categoryName as string).trim() : '';
	if (category !== '') parts.push(`Category: ${category}`);
	parts.push(url);
	const full = parts.join('\n\n');
	if (full.length <= SHARE_SNIPPET_MAX) return full;
	const budget = SHARE_SNIPPET_MAX - url.length - 1;
	return `${truncateText(parts.slice(0, -1).join('\n\n'), Math.max(budget, title.length))}\n${url}`;
}

/** States whose content must never render publicly (PRD §65.10.5). */
export const RESTRICTED_REQUEST_STATES: ReadonlySet<string> = new Set([
	'draft',
	'archived',
	'cancelled',
	'under_review',
]);

export type DetailView = { request: null } | { request: ShareableRequest; ownerOnly: boolean };

/**
 * Resolve what the detail route may render. Restricted states render only for
 * the owner (with a state badge); everyone else — including anonymous
 * viewers — gets `request: null` so the route serves the generic 404 +
 * fallback metadata, never the request's title/description.
 */
export function resolveDetailView(options: {
	request: ShareableRequest | null;
	viewerUserId?: string | null;
	authorId?: string | null;
}): DetailView {
	const { request, viewerUserId, authorId } = options;
	if (!request) return { request: null };
	if (!RESTRICTED_REQUEST_STATES.has(request.state)) return { request, ownerOnly: false };
	const isOwner = !!viewerUserId && !!authorId && viewerUserId === authorId;
	if (isOwner) return { request, ownerOnly: true };
	return { request: null };
}
