import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Header } from '../components/header';

vi.mock('@tanstack/react-router', () => ({
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

describe('Header', () => {
	test('renders "Ask for help" link for request creation', () => {
		render(
			<Header
				auth={{
					user: { id: '1', email: 'test@example.com' },
					profile: { name: 'Test User', photoUrl: null },
				}}
			/>,
		);
		const link = screen.getByText('Ask for help');
		expect(link).toBeTruthy();
		expect(link.getAttribute('href')).toBe('/requests/new');
	});

	test('does not render "New request" link', () => {
		render(
			<Header
				auth={{
					user: { id: '1', email: 'test@example.com' },
					profile: { name: 'Test User', photoUrl: null },
				}}
			/>,
		);
		expect(screen.queryByText('New request')).toBeNull();
	});
});
