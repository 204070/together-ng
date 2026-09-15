import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { createRequestFn } from '../../lib/server';

// Placeholder wired to the API (the multi-step wizard lands in #9).
export const Route = createFileRoute('/requests/new')({
	component: NewRequestPage,
});

function NewRequestPage() {
	const createRequest = useServerFn(createRequestFn);
	const [title, setTitle] = useState('');
	const [goal, setGoal] = useState('');
	const [createdId, setCreatedId] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setFailure(null);
		setCreatedId(null);
		try {
			const created = await createRequest({ data: { title, goal } });
			setCreatedId(created.id);
		} catch (error) {
			setFailure(error instanceof Error ? error.message : 'Could not create request');
		}
	}

	return (
		<section>
			<h1>New request</h1>
			<form onSubmit={onSubmit}>
				<label>
					Title
					<input value={title} onChange={(event) => setTitle(event.target.value)} />
				</label>
				<label>
					Goal
					<textarea value={goal} onChange={(event) => setGoal(event.target.value)} />
				</label>
				<button type="submit">Create draft</button>
			</form>
			{createdId ? (
				<p>
					Draft created:{' '}
					<Link to="/requests/$requestId" params={{ requestId: createdId }}>
						{createdId}
					</Link>
				</p>
			) : null}
			{failure ? <p role="alert">{failure}</p> : null}
		</section>
	);
}
