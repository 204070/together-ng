import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	buildShareText,
	canonicalPathFor,
	canonicalUrlFor,
	cardImageUrlFor,
	FALLBACK_CARD_PATH,
	resolveDetailView,
	SHARE_SNIPPET_MAX,
	shareContentFor,
	truncateText,
} from '../components/share/canonical';
import { ShareButton } from '../components/share/share-button';
import { ToastProvider } from '../components/toast';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('canonical URLs (§65.10.1)', () => {
	test('request canonical path matches the detail route discovery links to', () => {
		expect(canonicalPathFor('request', 'abc-123')).toBe('/requests/abc-123');
	});

	test('pattern is extensible to future public entities', () => {
		expect(canonicalPathFor('profile', 'u1')).toBe('/profiles/u1');
		expect(canonicalPathFor('resource', 'r1')).toBe('/resources/r1');
		expect(canonicalPathFor('category', 'health')).toBe('/categories/health');
		expect(canonicalPathFor('knowledge', 'guide')).toBe('/knowledge/guide');
	});

	test('absolute URL joins the site origin; unknown origin stays relative', () => {
		expect(canonicalUrlFor('request', 'abc', 'https://together.example/')).toBe(
			'https://together.example/requests/abc',
		);
		expect(canonicalUrlFor('request', 'abc')).toBe('/requests/abc');
	});

	test('copying twice yields the same URL (stable, no tokens)', () => {
		const first = canonicalUrlFor('request', 'abc', 'https://together.example');
		const second = canonicalUrlFor('request', 'abc', 'https://together.example');
		expect(first).toBe(second);
		expect(first).not.toContain('?');
	});
});

describe('card image URLs', () => {
	test('falls back to the generic servable card before generation completes', () => {
		expect(cardImageUrlFor({ requestId: 'abc' })).toBe(FALLBACK_CARD_PATH);
		expect(cardImageUrlFor({ requestId: 'abc', siteUrl: 'https://together.example' })).toBe(
			`https://together.example${FALLBACK_CARD_PATH}`,
		);
	});

	test('uses the versioned pipeline URL once a card version exists', () => {
		expect(
			cardImageUrlFor({ requestId: 'abc', siteUrl: 'https://together.example', cardVersion: 'v3' }),
		).toBe('https://together.example/social/requests/abc/v3.png');
	});
});

describe('share content (single source of truth, §65.10.2)', () => {
	test('description is the goal summary, truncated', () => {
		const { title, description } = shareContentFor({
			id: 'r1',
			title: 'Help me move',
			goal: 'I need two people with a van on Saturday morning to move boxes.',
			state: 'published',
		});
		expect(title).toBe('Help me move');
		expect(description).toBe('I need two people with a van on Saturday morning to move boxes.');
	});

	test('blank goal falls back to the title', () => {
		expect(shareContentFor({ id: 'r1', title: 'T', goal: '   ', state: '' }).description).toBe('T');
	});

	test('truncateText caps length on a word boundary', () => {
		const long = `${'word '.repeat(60)}end`;
		const out = truncateText(long, 200);
		expect(out.length).toBeLessThanOrEqual(200);
		expect(out.endsWith('…')).toBe(true);
		expect(truncateText('short', 200)).toBe('short');
	});

	test('share snippet contains title + goal summary + category + link within 500 chars', () => {
		const url = 'https://together.example/requests/r1';
		const text = buildShareText({
			title: 'Help me move',
			goal: `${'a'.repeat(150)} ${'b'.repeat(300)}`,
			categoryName: 'Logistics',
			url,
		});
		expect(text).toContain('Help me move');
		expect(text).toContain('Category: Logistics');
		expect(text).toContain(url);
		expect(text.length).toBeLessThanOrEqual(SHARE_SNIPPET_MAX);
	});
});

describe('detail visibility (§65.10.5)', () => {
	const req = { id: 'r1', title: 'T', goal: 'G', state: 'published' };

	test('public states render for anonymous viewers', () => {
		for (const state of ['published', 'receiving_responses', 'completed', 'closed']) {
			const view = resolveDetailView({ request: { ...req, state }, viewerUserId: null });
			expect(view.request).not.toBeNull();
		}
	});

	test('draft/archived/cancelled/under_review return null for anonymous viewers', () => {
		for (const state of ['draft', 'archived', 'cancelled', 'under_review']) {
			const view = resolveDetailView({ request: { ...req, state }, viewerUserId: null });
			expect(view.request).toBeNull();
		}
	});

	test('owner sees restricted states as owner-only (state badge)', () => {
		const view = resolveDetailView({
			request: { ...req, state: 'draft' },
			viewerUserId: 'owner-1',
			authorId: 'owner-1',
		});
		expect(view.request).not.toBeNull();
		expect(view).toMatchObject({ ownerOnly: true });
	});

	test('non-owner authenticated viewers get null for restricted states', () => {
		const view = resolveDetailView({
			request: { ...req, state: 'archived' },
			viewerUserId: 'other',
			authorId: 'owner-1',
		});
		expect(view.request).toBeNull();
	});
});

describe('ShareButton (§65.10.10)', () => {
	const props = {
		title: 'Help me move',
		text: 'Help me move\n\nNeed a van\n\nhttps://together.example/requests/r1',
		url: 'https://together.example/requests/r1',
	};

	function renderButton() {
		return render(
			<ToastProvider>
				<ShareButton {...props} />
			</ToastProvider>,
		);
	}

	test('uses navigator.share where available', async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { share });
		renderButton();
		fireEvent.click(screen.getByTestId('share-button'));
		await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
		expect(share).toHaveBeenCalledWith({ title: props.title, text: props.text, url: props.url });
	});

	test('falls back to copy-link with a "Link copied" toast', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		renderButton();
		fireEvent.click(screen.getByTestId('share-button'));
		await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(props.url));
		expect((await screen.findAllByText('Link copied')).length).toBeGreaterThanOrEqual(1);
		expect(screen.getByTestId('share-button').textContent).toBe('Link copied');
	});

	test('stays silent when the user dismisses the native share sheet', async () => {
		const abort = new Error('dismissed');
		abort.name = 'AbortError';
		const share = vi.fn().mockRejectedValue(abort);
		const writeText = vi.fn();
		vi.stubGlobal('navigator', { share, clipboard: { writeText } });
		renderButton();
		fireEvent.click(screen.getByTestId('share-button'));
		await vi.waitFor(() => expect(share).toHaveBeenCalledTimes(1));
		// No copy fallback, no toast after a user dismissal.
		expect(writeText).not.toHaveBeenCalled();
		expect(screen.queryByText('Link copied')).toBeNull();
	});
});
