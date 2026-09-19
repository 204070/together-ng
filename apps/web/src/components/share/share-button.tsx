import { useCallback, useState } from 'react';
import { useToast } from '../toast';

export interface ShareButtonProps {
	title: string;
	/** Snippet text (title + summary + category + link, ≤500 chars). */
	text: string;
	/** Canonical shareable URL. */
	url: string;
}

type NavigatorWithShare = Navigator & {
	share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
};

async function copyToClipboard(text: string): Promise<void> {
	const nav = globalThis.navigator as (Navigator & { clipboard?: Clipboard }) | undefined;
	if (nav?.clipboard?.writeText) {
		await nav.clipboard.writeText(text);
		return;
	}
	// Legacy fallback for browsers without the async clipboard API.
	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.style.position = 'absolute';
	area.style.left = '-9999px';
	document.body.appendChild(area);
	area.select();
	document.execCommand('copy');
	document.body.removeChild(area);
}

/**
 * Share action for request detail pages (PRD §65.10.10): native Web Share API
 * where available, otherwise copy-link with a "Link copied" toast. Requires
 * no login — all inputs arrive as props.
 */
export function ShareButton({ title, text, url }: ShareButtonProps) {
	const { addToast } = useToast();
	const [copied, setCopied] = useState(false);

	const onShare = useCallback(async () => {
		const nav = (typeof globalThis.navigator !== 'undefined' ? globalThis.navigator : undefined) as
			| NavigatorWithShare
			| undefined;
		if (nav?.share) {
			try {
				await nav.share({ title, text, url });
				return;
			} catch (error) {
				// User dismissal is not a failure — stay silent.
				if (error instanceof Error && error.name === 'AbortError') return;
				// Fall through to copy-link on any other share failure.
			}
		}
		try {
			await copyToClipboard(url);
			setCopied(true);
			addToast('Link copied', 'success');
		} catch {
			addToast('Could not copy the link', 'error');
		}
	}, [title, text, url, addToast]);

	return (
		<button type="button" onClick={() => void onShare()} data-testid="share-button">
			{copied ? 'Link copied' : 'Share'}
		</button>
	);
}
