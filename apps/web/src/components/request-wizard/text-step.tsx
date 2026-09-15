import { useState } from 'react';

interface TextStepProps {
	label: string;
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	helperText?: string;
	qualityHints?: string[];
	error?: string | null;
}

export function TextStep({
	label,
	placeholder,
	value,
	onChange,
	helperText,
	qualityHints = [],
	error,
}: TextStepProps) {
	const [touched, setTouched] = useState(false);
	const showError = touched && error;
	return (
		<section>
			<h2>{label}</h2>
			{helperText && <p className="helper-text">{helperText}</p>}
			<div>
				<label htmlFor={`wizard-${label.toLowerCase().replace(/\s/g, '-')}`}>{label}</label>
				<textarea
					id={`wizard-${label.toLowerCase().replace(/\s/g, '-')}`}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onBlur={() => setTouched(true)}
					placeholder={placeholder}
					rows={4}
				/>
				{showError && (
					<p role="alert" className="error">
						{error}
					</p>
				)}
				{qualityHints.length > 0 && (
					<ul className="quality-hints">
						{qualityHints.map((hint) => (
							<li key={hint} className="hint">
								{hint}
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
