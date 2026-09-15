import { useCallback, useState } from 'react';

interface VoteButtonProps {
	requestId: string;
	initialVoteCount: number;
	initialHasVoted: boolean;
	isAuthenticated: boolean;
	onVoteChange?: (voteCount: number, hasVoted: boolean) => void;
}

export function VoteButton({
	requestId,
	initialVoteCount,
	initialHasVoted,
	isAuthenticated,
	onVoteChange,
}: VoteButtonProps) {
	const [voteCount, setVoteCount] = useState(initialVoteCount);
	const [hasVoted, setHasVoted] = useState(initialHasVoted);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleVote = useCallback(async () => {
		if (!isAuthenticated || isSubmitting) return;

		const prevVoteCount = voteCount;
		const prevHasVoted = hasVoted;

		// Optimistic update
		if (hasVoted) {
			setVoteCount((c) => c - 1);
			setHasVoted(false);
		} else {
			setVoteCount((c) => c + 1);
			setHasVoted(true);
		}
		setIsSubmitting(true);

		try {
			const method = hasVoted ? 'DELETE' : 'POST';
			const res = await fetch(`/api/requests/${requestId}/vote`, {
				method,
				credentials: 'include',
			});

			if (res.ok) {
				const data = (await res.json()) as { voteCount: number; hasVoted: boolean };
				setVoteCount(data.voteCount);
				setHasVoted(data.hasVoted);
				onVoteChange?.(data.voteCount, data.hasVoted);
			} else {
				// Rollback on error
				setVoteCount(prevVoteCount);
				setHasVoted(prevHasVoted);
				onVoteChange?.(prevVoteCount, prevHasVoted);
			}
		} catch {
			// Rollback on network error
			setVoteCount(prevVoteCount);
			setHasVoted(prevHasVoted);
			onVoteChange?.(prevVoteCount, prevHasVoted);
		} finally {
			setIsSubmitting(false);
		}
	}, [requestId, voteCount, hasVoted, isAuthenticated, isSubmitting, onVoteChange]);

	return (
		<button
			type="button"
			onClick={handleVote}
			disabled={!isAuthenticated || isSubmitting}
			aria-label={hasVoted ? 'Remove vote' : 'Upvote'}
			data-voted={hasVoted}
			className="vote-button"
		>
			<span className="vote-icon">{hasVoted ? '\u25B2' : '\u25B3'}</span>
			<span className="vote-count">{voteCount}</span>
		</button>
	);
}
