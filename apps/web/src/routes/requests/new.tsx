import { createFileRoute, redirect, useSearch } from '@tanstack/react-router';
import { RequestWizard } from '../../components/request-wizard';
import { getAuthUserFn } from '../../lib/server';

export interface NewRequestSearchParams {
	step?: string;
	draft?: string;
}

export const Route = createFileRoute('/requests/new')({
	loader: async () => {
		const auth = await getAuthUserFn();
		if (!auth.user) {
			throw redirect({
				to: '/auth/login',
				search: { redirect: '/requests/new' },
			});
		}
		return { auth };
	},
	validateSearch: (search: Record<string, unknown>): NewRequestSearchParams => ({
		step: typeof search.step === 'string' ? search.step : undefined,
		draft: typeof search.draft === 'string' ? search.draft : undefined,
	}),
	component: NewRequestPage,
});

function NewRequestPage() {
	const { step = 'category', draft } = useSearch({ from: '/requests/new' });
	return (
		<section>
			<h1>Create a request</h1>
			<p>
				A specific request is more likely to receive useful responses. Take a moment to describe
				what you need and why.
			</p>
			<RequestWizard initialStep={step} initialDraftId={draft} />
		</section>
	);
}
