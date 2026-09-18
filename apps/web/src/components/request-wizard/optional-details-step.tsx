import type { WizardData } from './types';

interface OptionalDetailsStepProps {
	data: WizardData;
	onUpdate: (patch: Partial<WizardData>) => void;
	categoryId?: number | null;
}

interface FieldConfig {
	key: string;
	label: string;
	type: 'select' | 'text' | 'textarea' | 'datetime-local';
	options?: { value: string; label: string }[];
	placeholder?: string;
	rows?: number;
}

const COMMON_FIELDS: FieldConfig[] = [
	{
		key: 'modality',
		label: 'How would help be delivered?',
		type: 'select',
		options: [
			{ value: '', label: 'No preference' },
			{ value: 'online', label: 'Online' },
			{ value: 'in_person', label: 'In person' },
			{ value: 'both', label: 'Both' },
		],
	},
	{
		key: 'location',
		label: 'Location',
		type: 'text',
		placeholder: 'City, neighborhood, or online',
	},
	{
		key: 'helpType',
		label: 'What kind of help?',
		type: 'select',
		options: [
			{ value: '', label: 'Not specified' },
			{ value: 'borrow', label: 'Borrow' },
			{ value: 'receive', label: 'Receive' },
			{ value: 'access', label: 'Access' },
			{ value: 'learn', label: 'Learn' },
			{ value: 'collaborate', label: 'Collaborate' },
		],
	},
];

// Default: show all common fields plus time commitment, duration, deadline, skill level, quantity, intended outcome
const DEFAULT_CATEGORY_FIELDS: FieldConfig[] = [
	...COMMON_FIELDS,
	{
		key: 'timeCommitment',
		label: 'Time commitment',
		type: 'text',
		placeholder: 'e.g., 2 hours/week',
	},
	{ key: 'duration', label: 'Duration', type: 'text', placeholder: 'e.g., 3 months' },
	{ key: 'deadline', label: 'Deadline', type: 'datetime-local' },
	{
		key: 'skillLevel',
		label: 'Skill level',
		type: 'select',
		options: [
			{ value: '', label: 'Not specified' },
			{ value: 'beginner', label: 'Beginner' },
			{ value: 'intermediate', label: 'Intermediate' },
			{ value: 'advanced', label: 'Advanced' },
		],
	},
	{ key: 'quantity', label: 'Quantity needed', type: 'text', placeholder: 'e.g., 1 laptop' },
	{
		key: 'intendedOutcome',
		label: 'Intended outcome',
		type: 'textarea',
		placeholder: 'What do you hope to achieve?',
		rows: 3,
	},
];

const CATEGORY_FIELDS: Record<string, FieldConfig[]> = {
	// Technology: modality, location, skill level, duration, deadline
	technology: [
		...COMMON_FIELDS.filter((f) => ['modality', 'location'].includes(f.key)),
		{
			key: 'skillLevel',
			label: 'Skill level',
			type: 'select',
			options: [
				{ value: '', label: 'Not specified' },
				{ value: 'beginner', label: 'Beginner' },
				{ value: 'intermediate', label: 'Intermediate' },
				{ value: 'advanced', label: 'Advanced' },
			],
		},
		{ key: 'duration', label: 'Duration', type: 'text', placeholder: 'e.g., 3 months' },
		{ key: 'deadline', label: 'Deadline', type: 'datetime-local' },
	],
	// Education: modality, location, skill level, time commitment, duration
	education: [
		...COMMON_FIELDS.filter((f) => ['modality', 'location'].includes(f.key)),
		{
			key: 'skillLevel',
			label: 'Skill level',
			type: 'select',
			options: [
				{ value: '', label: 'Not specified' },
				{ value: 'beginner', label: 'Beginner' },
				{ value: 'intermediate', label: 'Intermediate' },
				{ value: 'advanced', label: 'Advanced' },
			],
		},
		{
			key: 'timeCommitment',
			label: 'Time commitment',
			type: 'text',
			placeholder: 'e.g., 2 hours/week',
		},
		{ key: 'duration', label: 'Duration', type: 'text', placeholder: 'e.g., 3 months' },
	],
	// Health: modality, location, deadline
	health: [
		...COMMON_FIELDS.filter((f) => ['modality', 'location'].includes(f.key)),
		{ key: 'deadline', label: 'Deadline', type: 'datetime-local' },
	],
	// Resources: modality, location, quantity, deadline
	resources: [
		...COMMON_FIELDS.filter((f) => ['modality', 'location'].includes(f.key)),
		{ key: 'quantity', label: 'Quantity needed', type: 'text', placeholder: 'e.g., 1 laptop' },
		{ key: 'deadline', label: 'Deadline', type: 'datetime-local' },
	],
	default: DEFAULT_CATEGORY_FIELDS,
};

function getFieldsForCategory(categoryId: number | null | undefined): FieldConfig[] {
	if (categoryId === null || categoryId === undefined) return DEFAULT_CATEGORY_FIELDS;
	const slugMap: Record<number, string> = {
		1: 'technology',
		2: 'education',
		3: 'health',
		4: 'resources',
	};
	const slug = slugMap[categoryId];
	if (!slug) return DEFAULT_CATEGORY_FIELDS;
	return CATEGORY_FIELDS[slug] ?? DEFAULT_CATEGORY_FIELDS;
}

export function OptionalDetailsStep({ data, onUpdate, categoryId }: OptionalDetailsStepProps) {
	const fields = getFieldsForCategory(categoryId);

	return (
		<section>
			<h2>Optional details</h2>
			<p className="helper-text">
				Add any additional details that will help others understand your request.
			</p>
			{fields.map((field) => {
				const value = (data as unknown as Record<string, string | null>)[field.key] ?? '';

				if (field.type === 'select') {
					return (
						<div key={field.key}>
							<label htmlFor={`wizard-${field.key}`}>{field.label}</label>
							<select
								id={`wizard-${field.key}`}
								value={value}
								onChange={(e) => onUpdate({ [field.key]: e.target.value || null })}
							>
								{field.options?.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</div>
					);
				}

				if (field.type === 'textarea') {
					return (
						<div key={field.key}>
							<label htmlFor={`wizard-${field.key}`}>{field.label}</label>
							<textarea
								id={`wizard-${field.key}`}
								value={value}
								onChange={(e) => onUpdate({ [field.key]: e.target.value || null })}
								placeholder={field.placeholder}
								rows={field.rows ?? 3}
							/>
						</div>
					);
				}

				if (field.type === 'datetime-local') {
					return (
						<div key={field.key}>
							<label htmlFor={`wizard-${field.key}`}>{field.label}</label>
							<input
								id={`wizard-${field.key}`}
								type="datetime-local"
								value={value ? value.slice(0, 16) : ''}
								onChange={(e) =>
									onUpdate({
										[field.key]: e.target.value ? new Date(e.target.value).toISOString() : null,
									})
								}
							/>
						</div>
					);
				}

				return (
					<div key={field.key}>
						<label htmlFor={`wizard-${field.key}`}>{field.label}</label>
						<input
							id={`wizard-${field.key}`}
							type="text"
							value={value}
							onChange={(e) => onUpdate({ [field.key]: e.target.value || null })}
							placeholder={field.placeholder}
						/>
					</div>
				);
			})}
		</section>
	);
}
