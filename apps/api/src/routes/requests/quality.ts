import type { RequestDraftCreateType, RequestPatchType } from '@together/schemas';

type Input = Partial<RequestDraftCreateType & RequestPatchType> & {
	title?: string;
	goal?: string;
	barrier?: string;
	helpNeeded?: string;
};
export function qualityHints(input: Input): string[] {
	const hints: string[] = [];
	const goal = typeof input.goal === 'string' ? input.goal.trim() : '';
	const barrier = typeof input.barrier === 'string' ? input.barrier.trim() : '';
	const helpNeeded = typeof input.helpNeeded === 'string' ? input.helpNeeded.trim() : '';
	const title = typeof input.title === 'string' ? input.title.trim() : '';
	if (goal.length > 0 && goal.length < 20) {
		if (/^i need a laptop\.?$/i.test(goal) || /^i need a laptop/i.test(goal))
			hints.push('What are you trying to do with the laptop?');
		else
			hints.push('Add more detail to your goal so contributors know what you want to accomplish.');
	}
	if (goal.length === 0 && title.length > 0) hints.push('Describe your goal in more detail.');
	if (barrier.length > 0 && barrier.length < 20)
		hints.push('Explain the barrier in more detail so helpers understand what is blocking you.');
	if (helpNeeded.length > 0 && helpNeeded.length < 20)
		hints.push('Describe the help you need more specifically.');
	if (goal.length === 0 || barrier.length === 0 || helpNeeded.length === 0) {
		if (!hints.includes('Describe your goal in more detail.') && goal.length === 0)
			hints.push('Add a goal: what are you trying to accomplish?');
		if (barrier.length === 0) hints.push('Add a barrier: what is preventing progress?');
		if (helpNeeded.length === 0) hints.push('Add what kind of help would move you forward.');
	}
	return [...new Set(hints)];
}
export function missingFields(input: {
	title?: string | null;
	goal?: string | null;
	barrier?: string | null;
	helpNeeded?: string | null;
	categoryId?: number | null;
}): string[] {
	const missing: string[] = [];
	if (!input.title || input.title.trim() === '') missing.push('title');
	if (!input.goal || input.goal.trim() === '') missing.push('goal');
	if (!input.barrier || input.barrier.trim() === '') missing.push('barrier');
	if (!input.helpNeeded || input.helpNeeded.trim() === '') missing.push('helpNeeded');
	if (input.categoryId === null || input.categoryId === undefined) missing.push('categoryId');
	return missing;
}
