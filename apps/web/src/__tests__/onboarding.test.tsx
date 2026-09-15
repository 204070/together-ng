import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lib/server', () => ({
	getAuthUserFn: vi.fn(),
	createProfileFn: vi.fn(),
	updateProfileFn: vi.fn(),
	getCategoriesFn: vi.fn(),
	getSkillsForCategoryFn: vi.fn(),
}));

import { OnboardingPage } from '../routes/onboarding';

afterEach(() => cleanup());

function renderOnboarding(authData: { user: unknown; profile: unknown }) {
	// Create a route tree with OnboardingPage that passes auth as props
	const { createRootRoute, createRoute } = require('@tanstack/react-router');
	const rootRoute = createRootRoute({
		component: () => <OnboardingPage auth={authData} />,
	});
	const onbRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/onboarding',
		component: () => <OnboardingPage auth={authData} />,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([onbRoute]),
		history: createMemoryHistory({ initialEntries: ['/onboarding'] }),
	});
	return render(<RouterProvider router={router} />);
}

describe('Onboarding page', () => {
	test('shows sign-in required when unauthenticated', async () => {
		renderOnboarding({ user: null, profile: null });
		expect(await screen.findByText('Sign in required')).toBeTruthy();
		expect(screen.getByText('Create an account')).toBeTruthy();
	});

	test('shows profile basics step 1 for new user', async () => {
		renderOnboarding({
			user: { id: 'u1', email: 'alice@example.com' },
			profile: null,
		});
		expect(await screen.findByText('Set up your profile')).toBeTruthy();
		expect(screen.getByText('Step 1 of 3')).toBeTruthy();
		expect(screen.getByLabelText('Name')).toBeTruthy();
	});

	test('shows edit profile flow for existing profile', async () => {
		renderOnboarding({
			user: { id: 'u1', email: 'alice@example.com' },
			profile: {
				name: 'Alice',
				location: 'Lagos',
				description: 'Hello',
				areasOfInterest: [],
				skills: [],
				contributionAvailability: null,
			},
		});
		expect(await screen.findByText('Edit your profile')).toBeTruthy();
		expect(screen.getByText('Step 1 of 3')).toBeTruthy();
	});

	test('step 1 pre-fills name from email', async () => {
		renderOnboarding({
			user: { id: 'u1', email: 'alice@example.com' },
			profile: null,
		});
		const nameInput = await screen.findByLabelText('Name');
		expect((nameInput as HTMLInputElement).value).toBe('alice');
	});
});
