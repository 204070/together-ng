import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	createDraftFn,
	getCategoriesFn,
	getDraftFn,
	getPreviewFn,
	publishRequestFn,
	updateDraftFn,
} from '../../lib/server';
import { CategoryStep } from './category-step';
import { OptionalDetailsStep } from './optional-details-step';
import { PreviewStep } from './preview-step';
import { ProgressIndicator } from './progress-indicator';
import { TextStep } from './text-step';
import type { Category, PreviewData, WizardData, WizardStep } from './types';
import { INITIAL_WIZARD_DATA, WIZARD_STEPS } from './types';

interface RequestWizardProps {
	initialStep?: string;
	initialDraftId?: string;
}

export function RequestWizard({ initialStep, initialDraftId }: RequestWizardProps) {
	const navigate = useNavigate({ from: '/requests/new' });
	const fetchCategories = useServerFn(getCategoriesFn);
	const createDraft = useServerFn(createDraftFn);
	const updateDraft = useServerFn(updateDraftFn);
	const fetchPreview = useServerFn(getPreviewFn);
	const publish = useServerFn(publishRequestFn);
	const fetchDraft = useServerFn(getDraftFn);

	const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
		const validStep = WIZARD_STEPS.find((s) => s.key === initialStep);
		return validStep ? validStep.key : 'category';
	});
	const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
	const [data, setData] = useState<WizardData>(INITIAL_WIZARD_DATA);
	const [categories, setCategories] = useState<Category[] | null>(null);
	const [categoriesError, setCategoriesError] = useState<string | null>(null);
	const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
	const [preview, setPreview] = useState<PreviewData | null>(null);
	const [publishErrors, setPublishErrors] = useState<Record<string, string> | null>(null);
	const [isPublishing, setIsPublishing] = useState(false);
	const [qualityHints, setQualityHints] = useState<string[]>([]);
	const [published, setPublished] = useState(false);
	const draftIdRef = useRef<string | null>(initialDraftId ?? null);
	const [draftLoaded, setDraftLoaded] = useState(false);

	const loadCategories = useCallback(async () => {
		setCategoriesError(null);
		try {
			const result = await fetchCategories();
			setCategories(result.items);
		} catch {
			setCategoriesError('Failed to load categories. Please try again.');
		}
	}, [fetchCategories]);

	useEffect(() => {
		loadCategories();
	}, [loadCategories]);

	const loadDraft = useCallback(
		async (id: string) => {
			try {
				const draft = await fetchDraft({ data: id });
				setData({
					title: draft.title ?? '',
					goal: draft.goal ?? '',
					barrier: draft.barrier ?? '',
					helpNeeded: draft.helpNeeded ?? '',
					categoryId: draft.categoryId ?? null,
					modality: draft.modality ?? null,
					helpType: draft.helpType ?? null,
					location: draft.location ?? null,
					deadline: draft.deadline ?? null,
					timeCommitment: draft.timeCommitment ?? null,
					duration: draft.duration ?? null,
					skillLevel: draft.skillLevel ?? null,
					quantity: draft.quantity ?? null,
					intendedOutcome: draft.intendedOutcome ?? null,
				});
				setQualityHints(draft.qualityHints ?? []);
			} catch {
				// Draft not found or inaccessible
			} finally {
				setDraftLoaded(true);
			}
		},
		[fetchDraft],
	);

	useEffect(() => {
		if (initialDraftId && !draftLoaded) {
			loadDraft(initialDraftId);
		} else {
			setDraftLoaded(true);
		}
	}, [initialDraftId, draftLoaded, loadDraft]);

	const updateStepInUrl = useCallback(
		(step: WizardStep) => {
			setCurrentStep(step);
			navigate({
				search: (prev) => ({
					...prev,
					step,
					...(draftIdRef.current ? { draft: draftIdRef.current } : {}),
				}),
				replace: true,
			});
		},
		[navigate],
	);

	const persistDraft = useCallback(
		async (patch: Partial<WizardData>) => {
			try {
				const currentDraftId = draftIdRef.current;
				if (currentDraftId) {
					await updateDraft({ data: { id: currentDraftId, patch } });
				} else {
					const created = await createDraft({
						data: {
							title: patch.title ?? '',
							goal: patch.goal ?? '',
							barrier: patch.barrier ?? '',
							helpNeeded: patch.helpNeeded ?? '',
							categoryId: patch.categoryId ?? undefined,
						},
					});
					setDraftId(created.id);
					draftIdRef.current = created.id;
					setQualityHints(created.qualityHints ?? []);
					navigate({
						search: (prev) => ({ ...prev, draft: created.id }),
						replace: true,
					});
				}
			} catch {
				// Silently fail - draft save is best-effort
			}
		},
		[createDraft, updateDraft, navigate],
	);

	const updateData = useCallback(
		(partial: Partial<WizardData>) => {
			setData((prev) => {
				const next = { ...prev, ...partial };
				persistDraft(partial);
				return next;
			});
		},
		[persistDraft],
	);

	const currentIndex = WIZARD_STEPS.findIndex((s) => s.key === currentStep);
	const isFirstStep = currentIndex === 0;
	const isLastStep = currentIndex === WIZARD_STEPS.length - 1;

	const canAdvance = useMemo(() => {
		switch (currentStep) {
			case 'category':
				return (
					data.categoryId !== null && !categories?.find((c) => c.id === data.categoryId)?.retiredAt
				);
			case 'goal':
				return data.goal.trim() !== '';
			case 'barrier':
				return data.barrier.trim() !== '';
			case 'helpNeeded':
				return data.helpNeeded.trim() !== '';
			default:
				return true;
		}
	}, [currentStep, data, categories]);

	const goNext = useCallback(() => {
		if (!canAdvance) return;
		setCompletedSteps((prev) => new Set([...prev, currentStep]));
		const nextIndex = currentIndex + 1;
		const nextStep = WIZARD_STEPS[nextIndex];
		if (nextStep) {
			updateStepInUrl(nextStep.key);
		}
	}, [canAdvance, currentStep, currentIndex, updateStepInUrl]);

	const goBack = useCallback(() => {
		const prevIndex = currentIndex - 1;
		const prevStep = WIZARD_STEPS[prevIndex];
		if (prevStep) {
			updateStepInUrl(prevStep.key);
		}
	}, [currentIndex, updateStepInUrl]);

	const handlePublish = useCallback(async () => {
		if (!draftId) return;
		setIsPublishing(true);
		setPublishErrors(null);
		try {
			await publish({ data: draftId });
			setPublished(true);
			setTimeout(() => {
				navigate({ to: '/requests/$requestId', params: { requestId: draftId } });
			}, 1500);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Could not publish';
			try {
				const parsed = JSON.parse(message);
				if (parsed.fields) {
					setPublishErrors(parsed.fields);
					return;
				}
			} catch {
				// Not JSON
			}
			setPublishErrors({ form: message });
		} finally {
			setIsPublishing(false);
		}
	}, [draftId, publish, navigate]);

	const loadPreview = useCallback(async () => {
		if (!draftId) return;
		try {
			const result = await fetchPreview({ data: draftId });
			setPreview(result);
		} catch {
			// Fallback to local preview
		}
	}, [draftId, fetchPreview]);

	useEffect(() => {
		if (currentStep === 'preview' && draftId) {
			loadPreview();
		}
	}, [currentStep, draftId, loadPreview]);

	const editField = useCallback((step: WizardStep) => {
		setCurrentStep(step);
	}, []);

	const goalHints = qualityHints.filter(
		(h) => h.toLowerCase().includes('goal') || h.toLowerCase().includes('laptop'),
	);
	const barrierHints = qualityHints.filter(
		(h) => h.toLowerCase().includes('barrier') || h.toLowerCase().includes('detail'),
	);
	const helpHints = qualityHints.filter(
		(h) => h.toLowerCase().includes('help') || h.toLowerCase().includes('kind'),
	);

	return (
		<div className="request-wizard">
			{published && (
				<div role="status" className="success-toast">
					Request published!
				</div>
			)}

			<ProgressIndicator currentStep={currentStep} completedSteps={completedSteps} />

			{currentStep === 'category' && (
				<CategoryStep
					categories={categories}
					selectedCategoryId={data.categoryId}
					onSelect={(id) => updateData({ categoryId: id })}
					error={categoriesError}
					retryLoad={loadCategories}
				/>
			)}

			{currentStep === 'goal' && (
				<TextStep
					label="What are you trying to accomplish?"
					value={data.goal}
					onChange={(goal) => updateData({ goal })}
					qualityHints={goalHints}
					error={data.goal.trim() === '' ? 'Please describe your goal' : null}
				/>
			)}

			{currentStep === 'barrier' && (
				<TextStep
					label="What is preventing progress?"
					value={data.barrier}
					onChange={(barrier) => updateData({ barrier })}
					qualityHints={barrierHints}
					error={data.barrier.trim() === '' ? 'Please describe the barrier' : null}
				/>
			)}

			{currentStep === 'helpNeeded' && (
				<TextStep
					label="What would help you move forward?"
					value={data.helpNeeded}
					onChange={(helpNeeded) => updateData({ helpNeeded })}
					helperText="You don't need to know the exact resource — describe the problem and contributors can suggest help"
					qualityHints={helpHints}
					error={data.helpNeeded.trim() === '' ? 'Please describe what would help' : null}
				/>
			)}

			{currentStep === 'optionalDetails' && (
				<OptionalDetailsStep data={data} onUpdate={updateData} categoryId={data.categoryId} />
			)}

			{currentStep === 'preview' && preview && (
				<PreviewStep preview={preview} editField={editField} />
			)}

			{currentStep === 'preview' && publishErrors && (
				<div role="alert" className="publish-errors">
					{Object.entries(publishErrors).map(([field, message]) => (
						<p key={field}>
							{field}: {message}
						</p>
					))}
				</div>
			)}

			<div className="wizard-nav">
				{!isFirstStep && (
					<button type="button" onClick={goBack}>
						Back
					</button>
				)}
				{!isLastStep && (
					<button type="button" onClick={goNext} disabled={!canAdvance}>
						Continue
					</button>
				)}
				{isLastStep && (
					<button type="button" onClick={handlePublish} disabled={!canAdvance || isPublishing}>
						{isPublishing ? 'Publishing...' : 'Publish'}
					</button>
				)}
			</div>
		</div>
	);
}
