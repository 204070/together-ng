export interface WizardData {
	title: string;
	goal: string;
	barrier: string;
	helpNeeded: string;
	categoryId: number | null;
	modality: string | null;
	helpType: string | null;
	location: string | null;
	deadline: string | null;
	timeCommitment: string | null;
	duration: string | null;
	skillLevel: string | null;
	quantity: string | null;
	intendedOutcome: string | null;
}

export interface Category {
	id: number;
	name: string;
	slug: string;
	description: string | null;
	parentId: number | null;
	retiredAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface DraftResponse {
	id: string;
	authorId: string;
	categoryId: number | null;
	title: string;
	goal: string;
	barrier: string;
	helpNeeded: string;
	state: string;
	modality: string | null;
	helpType: string | null;
	location: string | null;
	timeCommitment: string | null;
	duration: string | null;
	deadline: string | null;
	skillLevel: string | null;
	intendedOutcome: string | null;
	quantity: string | null;
	publishedAt: string | null;
	closedAt: string | null;
	closedReason: string | null;
	underReview: boolean;
	createdAt: string;
	updatedAt: string;
	qualityHints?: string[];
}

export interface PreviewData {
	request: DraftResponse;
	missingFields: string[];
	qualityHints: string[];
}

export type WizardStep =
	| 'category'
	| 'goal'
	| 'barrier'
	| 'helpNeeded'
	| 'optionalDetails'
	| 'preview';

export const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
	{ key: 'category', label: 'Category' },
	{ key: 'goal', label: 'Goal' },
	{ key: 'barrier', label: 'Barrier' },
	{ key: 'helpNeeded', label: 'Requested Help' },
	{ key: 'optionalDetails', label: 'Details' },
	{ key: 'preview', label: 'Preview' },
];

export const INITIAL_WIZARD_DATA: WizardData = {
	title: '',
	goal: '',
	barrier: '',
	helpNeeded: '',
	categoryId: null,
	modality: null,
	helpType: null,
	location: null,
	deadline: null,
	timeCommitment: null,
	duration: null,
	skillLevel: null,
	quantity: null,
	intendedOutcome: null,
};
