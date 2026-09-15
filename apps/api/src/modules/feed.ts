import { Elysia } from 'elysia';
import type { AuthServices } from './auth/services';
import { type RequestRow, toResponse } from './requests/store';

// Placeholder feed for issue #7 (SSR wiring only). Issue #10 replaces this
// with the real feed service. Public endpoint: no auth required so the web
// SSR loader can render the first paint without a user session.
export function createFeedRouter(services: AuthServices) {
	return new Elysia().get('/requests/featured', async () => {
		const rows = await services.sql<RequestRow[]>`
			SELECT id, author_id, category_id, title, goal, barrier, help_needed, state,
				modality, help_type, location, time_commitment, duration, deadline,
				skill_level, intended_outcome, quantity, published_at, closed_at,
				closed_reason, under_review, created_at, updated_at
			FROM requests
			WHERE state = 'published'
			ORDER BY created_at DESC
			LIMIT 20`;
		return { items: rows.map(toResponse) };
	});
}
