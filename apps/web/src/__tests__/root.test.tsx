import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { Header } from '../components/header';

afterEach(() => cleanup());

// Smoke test for the router shell: the root layout renders the primary nav
// inside a real router so <Link> targets resolve.
function renderHeader() {
	const rootRoute = createRootRoute({
		component: () => (
			<>
				<Header auth={{ user: null, profile: null }} />
			</>
		),
	});
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/',
		component: () => <div>home</div>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([indexRoute]),
		history: createMemoryHistory({ initialEntries: ['/'] }),
	});
	return render(<RouterProvider router={router} />);
}

describe('root layout', () => {
	test('renders the primary nav', async () => {
		renderHeader();
		const nav = await screen.findByRole('navigation', { name: 'Primary' });
		expect(nav).toBeTruthy();
	});

	test('nav links to the feed and sign-in', async () => {
		renderHeader();
		expect(await screen.findByRole('link', { name: 'Feed' })).toBeTruthy();
		expect(await screen.findByRole('link', { name: 'Sign in' })).toBeTruthy();
	});
});
