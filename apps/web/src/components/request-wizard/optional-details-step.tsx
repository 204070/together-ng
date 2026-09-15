import type { WizardData } from './types';

interface OptionalDetailsStepProps {
	data: WizardData;
	onUpdate: (patch: Partial<WizardData>) => void;
}

export function OptionalDetailsStep({ data, onUpdate }: OptionalDetailsStepProps) {
	return (
		<section>
			<h2>Optional details</h2>
			<p className="helper-text">
				Add any additional details that will help others understand your request.
			</p>
			<div>
				<label htmlFor="wizard-modality">How would help be delivered?</label>
				<select
					id="wizard-modality"
					value={data.modality ?? ''}
					onChange={(e) => onUpdate({ modality: e.target.value || null })}
				>
					<option value="">No preference</option>
					<option value="online">Online</option>
					<option value="in_person">In person</option>
					<option value="both">Both</option>
				</select>
			</div>
			<div>
				<label htmlFor="wizard-help-type">What kind of help?</label>
				<select
					id="wizard-help-type"
					value={data.helpType ?? ''}
					onChange={(e) => onUpdate({ helpType: e.target.value || null })}
				>
					<option value="">Not specified</option>
					<option value="borrow">Borrow</option>
					<option value="receive">Receive</option>
					<option value="access">Access</option>
					<option value="learn">Learn</option>
					<option value="collaborate">Collaborate</option>
				</select>
			</div>
			<div>
				<label htmlFor="wizard-location">Location</label>
				<input
					id="wizard-location"
					type="text"
					value={data.location ?? ''}
					onChange={(e) => onUpdate({ location: e.target.value || null })}
					placeholder="City, neighborhood, or online"
				/>
			</div>
			<div>
				<label htmlFor="wizard-time-commitment">Time commitment</label>
				<input
					id="wizard-time-commitment"
					type="text"
					value={data.timeCommitment ?? ''}
					onChange={(e) => onUpdate({ timeCommitment: e.target.value || null })}
					placeholder="e.g., 2 hours/week"
				/>
			</div>
			<div>
				<label htmlFor="wizard-duration">Duration</label>
				<input
					id="wizard-duration"
					type="text"
					value={data.duration ?? ''}
					onChange={(e) => onUpdate({ duration: e.target.value || null })}
					placeholder="e.g., 3 months"
				/>
			</div>
			<div>
				<label htmlFor="wizard-deadline">Deadline</label>
				<input
					id="wizard-deadline"
					type="datetime-local"
					value={data.deadline ? data.deadline.slice(0, 16) : ''}
					onChange={(e) =>
						onUpdate({
							deadline: e.target.value ? new Date(e.target.value).toISOString() : null,
						})
					}
				/>
			</div>
			<div>
				<label htmlFor="wizard-skill-level">Skill level</label>
				<select
					id="wizard-skill-level"
					value={data.skillLevel ?? ''}
					onChange={(e) => onUpdate({ skillLevel: e.target.value || null })}
				>
					<option value="">Not specified</option>
					<option value="beginner">Beginner</option>
					<option value="intermediate">Intermediate</option>
					<option value="advanced">Advanced</option>
				</select>
			</div>
			<div>
				<label htmlFor="wizard-quantity">Quantity needed</label>
				<input
					id="wizard-quantity"
					type="text"
					value={data.quantity ?? ''}
					onChange={(e) => onUpdate({ quantity: e.target.value || null })}
					placeholder="e.g., 1 laptop"
				/>
			</div>
			<div>
				<label htmlFor="wizard-intended-outcome">Intended outcome</label>
				<textarea
					id="wizard-intended-outcome"
					value={data.intendedOutcome ?? ''}
					onChange={(e) => onUpdate({ intendedOutcome: e.target.value || null })}
					placeholder="What do you hope to achieve?"
					rows={3}
				/>
			</div>
		</section>
	);
}
