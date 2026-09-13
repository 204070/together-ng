const transitions: Record<string, string[]> = {
	draft: ['published', 'cancelled', 'archived', 'under_review'],
	published: ['receiving_responses', 'cancelled', 'archived', 'under_review'],
	receiving_responses: ['help_arranged', 'cancelled', 'archived', 'under_review'],
	help_arranged: ['in_progress', 'cancelled', 'archived', 'under_review'],
	in_progress: ['completed', 'cancelled', 'archived', 'under_review'],
	completed: ['closed', 'archived'],
	closed: ['archived'],
	cancelled: ['archived'],
	archived: [],
	under_review: ['draft', 'published', 'cancelled', 'archived'],
};
export function canTransition(from: string, to: string): boolean {
	const allowed = transitions[from];
	if (!allowed) return false;
	return allowed.includes(to);
}
