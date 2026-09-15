import type { WizardStep } from './types';
import { WIZARD_STEPS } from './types';

export function ProgressIndicator({
	currentStep,
	completedSteps,
}: {
	currentStep: WizardStep;
	completedSteps: Set<WizardStep>;
}) {
	return (
		<nav aria-label="Wizard progress" className="wizard-progress">
			<ol>
				{WIZARD_STEPS.map((step, index) => {
					const isCurrent = step.key === currentStep;
					const isCompleted = completedSteps.has(step.key);
					return (
						<li
							key={step.key}
							aria-current={isCurrent ? 'step' : undefined}
							className={[isCurrent ? 'current' : '', isCompleted ? 'completed' : '']
								.filter(Boolean)
								.join(' ')}
						>
							<span className="step-number">{isCompleted ? '\u2713' : index + 1}</span>
							<span className="step-label">{step.label}</span>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
