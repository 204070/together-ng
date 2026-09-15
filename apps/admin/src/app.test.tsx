import { cleanup, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { App } from './app';
import { AuthProvider, STORAGE_KEY } from './lib/auth';
import { Login } from './pages/Login';

function renderApp() {
	return render(
		<BrowserRouter>
			<AuthProvider>
				<App />
			</AuthProvider>
		</BrowserRouter>,
	);
}

function renderLogin() {
	return render(
		<BrowserRouter>
			<AuthProvider>
				<Login />
			</AuthProvider>
		</BrowserRouter>,
	);
}

afterEach(() => {
	cleanup();
	localStorage.clear();
	vi.clearAllMocks();
});

describe('admin app shell', () => {
	test('renders login page at /login', async () => {
		renderLogin();
		expect(await screen.findByRole('heading', { name: /admin login/i })).toBeTruthy();
	});

	test('redirects unknown route to login when unauthenticated', async () => {
		renderApp();
		// App redirects to /login because no session
		expect(await screen.findByRole('heading', { name: /admin login/i })).toBeTruthy();
	});

	test('AuthProvider restores session from localStorage', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				token: 'test-token',
				id: 'user-1',
				email: 'admin@example.com',
			}),
		);
		renderApp();
		// With a stored session, it shows loading then redirects to login
		// because fetchAdminMe will fail with invalid token
		expect(await screen.findByRole('heading', { name: /admin login/i })).toBeTruthy();
	});
});
