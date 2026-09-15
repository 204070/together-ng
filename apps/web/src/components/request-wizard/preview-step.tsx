import type { PreviewData, WizardStep } from './types';

export function PreviewStep({
	preview,
	editField,
}: {
	preview: PreviewData;
	editField: (step: WizardStep) => void;
}) {
	const { request, missingFields, qualityHints } = preview;
	return (
		<section>
			<h2>Preview your request</h2>
			{qualityHints.length > 0 && (
				<div className="quality-hints">
					<p>Suggestions to improve your request:</p>
					<ul>
						{qualityHints.map((hint) => (
							<li key={hint}>{hint}</li>
						))}
					</ul>
				</div>
			)}
			<dl>
				<div
					className={['preview-field', missingFields.includes('categoryId') ? 'missing' : '']
						.filter(Boolean)
						.join(' ')}
				>
					<dt>
						Category{' '}
						<button type="button" className="edit-link" onClick={() => editField('category')}>
							Edit
						</button>
					</dt>
					<dd>{request.categoryId !== null ? `Category #${request.categoryId}` : 'Not set'}</dd>
				</div>
				<div
					className={['preview-field', missingFields.includes('title') ? 'missing' : '']
						.filter(Boolean)
						.join(' ')}
				>
					<dt>
						Title{' '}
						<button type="button" className="edit-link" onClick={() => editField('goal')}>
							Edit
						</button>
					</dt>
					<dd>{request.title || 'Not set'}</dd>
				</div>
				<div
					className={['preview-field', missingFields.includes('goal') ? 'missing' : '']
						.filter(Boolean)
						.join(' ')}
				>
					<dt>
						Goal{' '}
						<button type="button" className="edit-link" onClick={() => editField('goal')}>
							Edit
						</button>
					</dt>
					<dd>{request.goal || 'Not set'}</dd>
				</div>
				<div
					className={['preview-field', missingFields.includes('barrier') ? 'missing' : '']
						.filter(Boolean)
						.join(' ')}
				>
					<dt>
						Barrier{' '}
						<button type="button" className="edit-link" onClick={() => editField('barrier')}>
							Edit
						</button>
					</dt>
					<dd>{request.barrier || 'Not set'}</dd>
				</div>
				<div
					className={['preview-field', missingFields.includes('helpNeeded') ? 'missing' : '']
						.filter(Boolean)
						.join(' ')}
				>
					<dt>
						Requested help{' '}
						<button type="button" className="edit-link" onClick={() => editField('helpNeeded')}>
							Edit
						</button>
					</dt>
					<dd>{request.helpNeeded || 'Not set'}</dd>
				</div>
				{request.modality && (
					<div className="preview-field">
						<dt>Modality</dt>
						<dd>{request.modality}</dd>
					</div>
				)}
				{request.location && (
					<div className="preview-field">
						<dt>Location</dt>
						<dd>{request.location}</dd>
					</div>
				)}
				{request.deadline && (
					<div className="preview-field">
						<dt>Deadline</dt>
						<dd>{new Date(request.deadline).toLocaleDateString()}</dd>
					</div>
				)}
				{request.skillLevel && (
					<div className="preview-field">
						<dt>Skill level</dt>
						<dd>{request.skillLevel}</dd>
					</div>
				)}
			</dl>
		</section>
	);
}
