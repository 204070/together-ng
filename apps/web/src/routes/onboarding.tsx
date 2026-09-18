import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import type { AuthState } from '../lib/server';
import {
	createProfileFn,
	getAuthUserFn,
	getCategoriesFn,
	getSkillsForCategoryFn,
	updateProfileFn,
} from '../lib/server';

export const Route = createFileRoute('/onboarding')({
	loader: async () => {
		const auth = await getAuthUserFn();
		if (!auth.user) {
			throw redirect({ to: '/auth/register', search: { returnUrl: '/onboarding' } });
		}
		return { auth };
	},
	component: () => {
		const { auth } = Route.useLoaderData();
		return <OnboardingPage auth={auth} />;
	},
});

export function OnboardingPage({ auth }: { auth: AuthState }) {
	if (!auth.user) {
		return (
			<section>
				<h1>Sign in required</h1>
				<p>You need to sign in to complete onboarding.</p>
				<Link to="/auth/register" search={{ returnUrl: '/onboarding' }}>
					Create an account
				</Link>
			</section>
		);
	}

	if (auth.profile) {
		return <EditProfileFlow profile={auth.profile} />;
	}

	return <NewProfileFlow auth={auth} />;
}

function EditProfileFlow({ profile }: { profile: NonNullable<AuthState['profile']> }) {
	const navigate = useNavigate();
	const updateProfile = useServerFn(updateProfileFn);
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [skipped, setSkipped] = useState(false);

	const defaultAvailability: OnboardingFormData['contributionAvailability'] = {
		modality: 'both',
		preferredArea: '',
		willingToMentor: false,
		willingToLend: false,
		willingToAnswerQuestions: false,
		willingToCollaborate: false,
	};

	const rawAvail = profile.contributionAvailability as
		| Partial<OnboardingFormData['contributionAvailability']>
		| null
		| undefined;

	const [formData, setFormData] = useState<OnboardingFormData>({
		name: profile.name ?? '',
		location: profile.location ?? '',
		description: profile.description ?? '',
		photoUrl: profile.photoUrl ?? '',
		areasOfInterest: profile.areasOfInterest ?? [],
		skills: profile.skills ?? [],
		contributionAvailability: rawAvail
			? {
					modality: rawAvail.modality ?? 'both',
					preferredArea: rawAvail.preferredArea ?? '',
					willingToMentor: rawAvail.willingToMentor ?? false,
					willingToLend: rawAvail.willingToLend ?? false,
					willingToAnswerQuestions: rawAvail.willingToAnswerQuestions ?? false,
					willingToCollaborate: rawAvail.willingToCollaborate ?? false,
				}
			: defaultAvailability,
	});

	function updateField<K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) {
		setFormData((prev) => ({ ...prev, [key]: value }));
	}

	async function onComplete(skipContributions: boolean) {
		setError(null);
		setSubmitting(true);
		try {
			const payload: Record<string, unknown> = {
				id: profile.id,
				name: formData.name,
				location: formData.location || undefined,
				description: formData.description || undefined,
				photoUrl: formData.photoUrl || undefined,
				areasOfInterest: formData.areasOfInterest,
				skills: formData.skills,
				contributionAvailability: skipContributions ? null : formData.contributionAvailability,
			};
			await updateProfile({ data: payload });
			if (skipContributions) {
				setSkipped(true);
			} else {
				await navigate({ to: '/' });
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Something went wrong');
		} finally {
			setSubmitting(false);
		}
	}

	if (skipped) {
		return (
			<section>
				<h1>Profile saved</h1>
				<p>That's okay. You can simply use Together when you need help.</p>
				<button type="button" onClick={() => navigate({ to: '/' })}>
					Go to home
				</button>
			</section>
		);
	}

	return (
		<section>
			<h1>Edit your profile</h1>
			<p>Step {step} of 3</p>
			{error ? <p role="alert">{error}</p> : null}
			{step === 1 && (
				<ProfileStep1 formData={formData} updateField={updateField} onNext={() => setStep(2)} />
			)}
			{step === 2 && (
				<ProfileStep2
					formData={formData}
					updateField={updateField}
					onBack={() => setStep(1)}
					onNext={() => setStep(3)}
					onSkip={() => onComplete(true)}
				/>
			)}
			{step === 3 && (
				<ProfileStep3
					formData={formData}
					updateField={updateField}
					onBack={() => setStep(2)}
					onComplete={() => onComplete(false)}
					onSkip={() => onComplete(true)}
					submitting={submitting}
				/>
			)}
		</section>
	);
}

function NewProfileFlow({ auth }: { auth: AuthState }) {
	const navigate = useNavigate();
	const createProfile = useServerFn(createProfileFn);
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [skipped, setSkipped] = useState(false);

	const [formData, setFormData] = useState<OnboardingFormData>({
		name: auth.user?.email?.split('@')[0] ?? '',
		location: '',
		description: '',
		photoUrl: '',
		areasOfInterest: [],
		skills: [],
		contributionAvailability: {
			modality: 'both',
			preferredArea: '',
			willingToMentor: false,
			willingToLend: false,
			willingToAnswerQuestions: false,
			willingToCollaborate: false,
		},
	});

	function updateField<K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) {
		setFormData((prev) => ({ ...prev, [key]: value }));
	}

	async function onComplete(skipContributions: boolean) {
		setError(null);
		setSubmitting(true);
		try {
			await createProfile({
				data: {
					name: formData.name,
					location: formData.location || undefined,
					description: formData.description || undefined,
					photoUrl: formData.photoUrl || undefined,
					areasOfInterest: formData.areasOfInterest,
					skills: formData.skills,
					contributionAvailability: skipContributions ? null : formData.contributionAvailability,
				},
			});
			if (skipContributions) {
				setSkipped(true);
			} else {
				await navigate({ to: '/' });
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Something went wrong');
		} finally {
			setSubmitting(false);
		}
	}

	if (skipped) {
		return (
			<section>
				<h1>Profile saved</h1>
				<p>That's okay. You can simply use Together when you need help.</p>
				<button type="button" onClick={() => navigate({ to: '/' })}>
					Go to home
				</button>
			</section>
		);
	}

	return (
		<section>
			<h1>Set up your profile</h1>
			<p>Step {step} of 3</p>
			{error ? <p role="alert">{error}</p> : null}
			{step === 1 && (
				<ProfileStep1 formData={formData} updateField={updateField} onNext={() => setStep(2)} />
			)}
			{step === 2 && (
				<ProfileStep2
					formData={formData}
					updateField={updateField}
					onBack={() => setStep(1)}
					onNext={() => setStep(3)}
					onSkip={() => onComplete(true)}
				/>
			)}
			{step === 3 && (
				<ProfileStep3
					formData={formData}
					updateField={updateField}
					onBack={() => setStep(2)}
					onComplete={() => onComplete(false)}
					onSkip={() => onComplete(true)}
					submitting={submitting}
				/>
			)}
		</section>
	);
}

interface OnboardingFormData {
	name: string;
	location: string;
	description: string;
	photoUrl: string;
	areasOfInterest: number[];
	skills: number[];
	contributionAvailability: {
		modality: 'online' | 'in_person' | 'both';
		preferredArea: string;
		willingToMentor: boolean;
		willingToLend: boolean;
		willingToAnswerQuestions: boolean;
		willingToCollaborate: boolean;
	};
}

function ProfileStep1({
	formData,
	updateField,
	onNext,
}: {
	formData: OnboardingFormData;
	updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
	onNext: () => void;
}) {
	const [errors, setErrors] = useState<Record<string, string>>({});

	function handleNext() {
		const e: Record<string, string> = {};
		if (!formData.name.trim()) e.name = 'Name is required';
		setErrors(e);
		if (Object.keys(e).length === 0) onNext();
	}

	return (
		<div>
			<h2>Profile basics</h2>
			<div>
				<label htmlFor="ob-name">Name</label>
				<input
					id="ob-name"
					type="text"
					value={formData.name}
					onChange={(e) => updateField('name', e.target.value)}
					aria-invalid={!!errors.name}
				/>
				{errors.name ? <p role="alert">{errors.name}</p> : null}
			</div>
			<div>
				<label htmlFor="ob-photo">Photo URL (optional)</label>
				<input
					id="ob-photo"
					type="url"
					value={formData.photoUrl}
					onChange={(e) => updateField('photoUrl', e.target.value)}
					placeholder="https://example.com/photo.jpg"
				/>
			</div>
			<div>
				<label htmlFor="ob-location">Location (optional)</label>
				<input
					id="ob-location"
					type="text"
					value={formData.location}
					onChange={(e) => updateField('location', e.target.value)}
				/>
			</div>
			<div>
				<label htmlFor="ob-description">About you (optional)</label>
				<textarea
					id="ob-description"
					value={formData.description}
					onChange={(e) => updateField('description', e.target.value)}
					maxLength={1000}
				/>
			</div>
			<InterestSelector formData={formData} updateField={updateField} />
			<button type="button" onClick={handleNext}>
				Next
			</button>
		</div>
	);
}

function InterestSelector({
	formData,
	updateField,
}: {
	formData: OnboardingFormData;
	updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
}) {
	const getCategories = useServerFn(getCategoriesFn);
	const getSkills = useServerFn(getSkillsForCategoryFn);
	const [categories, setCategories] = useState<Array<{ id: number; name: string; slug: string }>>(
		[],
	);
	const [skillsByCategory, setSkillsByCategory] = useState<
		Record<number, Array<{ id: number; name: string }>>
	>({});
	const [search, setSearch] = useState('');
	const [loading, setLoading] = useState(true);
	const [categoriesError, setCategoriesError] = useState<string | null>(null);
	const [skillsError, setSkillsError] = useState<Record<number, string>>({});

	async function loadCategories() {
		setLoading(true);
		setCategoriesError(null);
		try {
			const cats = await getCategories();
			setCategories(Array.isArray(cats) ? cats : []);
		} catch {
			setCategoriesError('Failed to load categories. Please try again.');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const cats = await getCategories();
				if (!cancelled) {
					setCategories(Array.isArray(cats) ? cats : []);
					setLoading(false);
				}
			} catch {
				if (!cancelled) {
					setCategoriesError('Failed to load categories. Please try again.');
					setLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [getCategories]);

	const filteredCategories = search
		? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
		: categories;

	const showSearch = categories.length > 10;

	async function toggleCategory(categoryId: number) {
		const current = formData.areasOfInterest;
		const next = current.includes(categoryId)
			? current.filter((id) => id !== categoryId)
			: [...current, categoryId];
		updateField('areasOfInterest', next);

		if (!skillsByCategory[categoryId]) {
			try {
				const skills = await getSkills({ data: categoryId });
				setSkillsByCategory((prev) => ({
					...prev,
					[categoryId]: Array.isArray(skills) ? skills : [],
				}));
				setSkillsError((prev) => {
					const next2 = { ...prev };
					delete next2[categoryId];
					return next2;
				});
			} catch {
				setSkillsError((prev) => ({
					...prev,
					[categoryId]: 'Failed to load skills for this category.',
				}));
			}
		}
	}

	async function retrySkills(categoryId: number) {
		try {
			setSkillsError((prev) => {
				const next = { ...prev };
				delete next[categoryId];
				return next;
			});
			const skills = await getSkills({ data: categoryId });
			setSkillsByCategory((prev) => ({
				...prev,
				[categoryId]: Array.isArray(skills) ? skills : [],
			}));
		} catch {
			setSkillsError((prev) => ({
				...prev,
				[categoryId]: 'Failed to load skills for this category.',
			}));
		}
	}

	function toggleSkill(skillId: number) {
		const current = formData.skills;
		const next = current.includes(skillId)
			? current.filter((id) => id !== skillId)
			: [...current, skillId];
		updateField('skills', next);
	}

	if (loading) {
		return <p>Loading categories...</p>;
	}

	if (categoriesError) {
		return (
			<div>
				<h3>What can you help with?</h3>
				<p role="alert">{categoriesError}</p>
				<button type="button" onClick={loadCategories}>
					Retry
				</button>
			</div>
		);
	}

	return (
		<div>
			<h3>What can you help with?</h3>
			<p>Select categories you can contribute to.</p>
			{showSearch ? (
				<div>
					<label htmlFor="cat-search">Search categories</label>
					<input
						id="cat-search"
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Filter categories..."
					/>
				</div>
			) : null}
			<fieldset>
				<legend>Categories</legend>
				{filteredCategories.map((cat) => (
					<div key={cat.id}>
						<label>
							<input
								type="checkbox"
								checked={formData.areasOfInterest.includes(cat.id)}
								onChange={() => toggleCategory(cat.id)}
							/>
							{cat.name}
						</label>
						{formData.areasOfInterest.includes(cat.id) && skillsByCategory[cat.id] ? (
							<fieldset>
								<legend>{cat.name} skills</legend>
								{skillsByCategory[cat.id]!.map((skill) => (
									<label key={skill.id}>
										<input
											type="checkbox"
											checked={formData.skills.includes(skill.id)}
											onChange={() => toggleSkill(skill.id)}
										/>
										{skill.name}
									</label>
								))}
							</fieldset>
						) : null}
						{formData.areasOfInterest.includes(cat.id) && skillsError[cat.id] ? (
							<div>
								<p role="alert">{skillsError[cat.id]}</p>
								<button type="button" onClick={() => retrySkills(cat.id)}>
									Retry
								</button>
							</div>
						) : null}
					</div>
				))}
			</fieldset>
		</div>
	);
}

function ProfileStep2({
	formData,
	updateField,
	onBack,
	onNext,
	onSkip,
}: {
	formData: OnboardingFormData;
	updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
	onBack: () => void;
	onNext: () => void;
	onSkip: () => void;
}) {
	const [skillFilter, setSkillFilter] = useState('');

	function _toggleSkill(skillId: number) {
		const current = formData.skills;
		const next = current.includes(skillId)
			? current.filter((id) => id !== skillId)
			: [...current, skillId];
		updateField('skills', next);
	}

	return (
		<div>
			<h2>Refine your skills</h2>
			<p>Select specific skills you can contribute, or skip to continue without selecting.</p>
			<div>
				<label htmlFor="skill-search">Search skills</label>
				<input
					id="skill-search"
					type="text"
					value={skillFilter}
					onChange={(e) => setSkillFilter(e.target.value)}
					placeholder="Filter skills..."
				/>
			</div>
			{formData.skills.length > 0 ? (
				<p>{formData.skills.length} skill(s) selected</p>
			) : (
				<p>No skills selected yet</p>
			)}
			<button type="button" onClick={onBack}>
				Back
			</button>
			<button type="button" onClick={onNext}>
				Next
			</button>
			<button type="button" onClick={onSkip}>
				Skip — I just need help for now
			</button>
		</div>
	);
}

function ProfileStep3({
	formData,
	updateField,
	onBack,
	onComplete,
	onSkip,
	submitting,
}: {
	formData: OnboardingFormData;
	updateField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
	onBack: () => void;
	onComplete: () => void;
	onSkip: () => void;
	submitting: boolean;
}) {
	function toggleModality(value: 'online' | 'in_person' | 'both') {
		updateField('contributionAvailability', {
			...formData.contributionAvailability,
			modality: value,
		});
	}

	function toggleWillingness(
		field:
			| 'willingToMentor'
			| 'willingToLend'
			| 'willingToAnswerQuestions'
			| 'willingToCollaborate',
		checked: boolean,
	) {
		updateField('contributionAvailability', {
			...formData.contributionAvailability,
			[field]: checked,
		});
	}

	return (
		<div>
			<h2>Contribution availability</h2>
			<p>How would you like to help? This is optional — you can always change it later.</p>
			<div>
				<p>How can you contribute?</p>
				<label>
					<input
						type="checkbox"
						checked={
							formData.contributionAvailability.modality === 'online' ||
							formData.contributionAvailability.modality === 'both'
						}
						onChange={() =>
							toggleModality(
								formData.contributionAvailability.modality === 'online' ? 'both' : 'online',
							)
						}
					/>
					Online
				</label>
				<label>
					<input
						type="checkbox"
						checked={
							formData.contributionAvailability.modality === 'in_person' ||
							formData.contributionAvailability.modality === 'both'
						}
						onChange={() =>
							toggleModality(
								formData.contributionAvailability.modality === 'in_person' ? 'both' : 'in_person',
							)
						}
					/>
					In person
				</label>
			</div>
			<div>
				<label htmlFor="ob-area">Preferred geographic area (optional)</label>
				<input
					id="ob-area"
					type="text"
					value={formData.contributionAvailability.preferredArea}
					onChange={(e) =>
						updateField('contributionAvailability', {
							...formData.contributionAvailability,
							preferredArea: e.target.value,
						})
					}
				/>
			</div>
			<div>
				<p>What are you willing to do?</p>
				<label>
					<input
						type="checkbox"
						checked={formData.contributionAvailability.willingToLend}
						onChange={(e) => toggleWillingness('willingToLend', e.target.checked)}
					/>
					Lend resources
				</label>
				<label>
					<input
						type="checkbox"
						checked={formData.contributionAvailability.willingToMentor}
						onChange={(e) => toggleWillingness('willingToMentor', e.target.checked)}
					/>
					Mentor
				</label>
				<label>
					<input
						type="checkbox"
						checked={formData.contributionAvailability.willingToAnswerQuestions}
						onChange={(e) => toggleWillingness('willingToAnswerQuestions', e.target.checked)}
					/>
					Answer questions
				</label>
				<label>
					<input
						type="checkbox"
						checked={formData.contributionAvailability.willingToCollaborate}
						onChange={(e) => toggleWillingness('willingToCollaborate', e.target.checked)}
					/>
					Collaborate
				</label>
			</div>
			<button type="button" onClick={onBack}>
				Back
			</button>
			<button type="button" onClick={onComplete} disabled={submitting}>
				{submitting ? 'Saving...' : 'Complete setup'}
			</button>
			<button type="button" onClick={onSkip}>
				Skip — I just need help for now
			</button>
		</div>
	);
}
