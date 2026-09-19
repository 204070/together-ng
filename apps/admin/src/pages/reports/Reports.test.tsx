import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Reports } from './Reports';

vi.mock('../../lib/api', () => ({
	fetchAdminReports: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({
	useAuth: () => ({ session: { token: 'test-token', id: 'admin-1', email: 'a@x.com' } }),
}));

import { fetchAdminReports } from '../../lib/api';

const mockedFetch = vi.mocked(fetchAdminReports);

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

beforeEach(() => {
	mockedFetch.mockReset();
});

describe('Reports queue', () => {
	test('shows a loading skeleton while fetching', () => {
		mockedFetch.mockReturnValue(new Promise(() => {}));
		render(<Reports />);
		expect(screen.getByLabelText('Loading reports')).toBeTruthy();
	});

	test('shows "No reports pending" for an empty queue', async () => {
		mockedFetch.mockResolvedValue({ reports: [], total: 0 });
		render(<Reports />);
		expect(await screen.findByText('No reports pending')).toBeTruthy();
		expect(mockedFetch).toHaveBeenCalledWith('test-token', { page: 1, limit: 25 });
	});

	test('lists reports with reason, category, status and created date', async () => {
		mockedFetch.mockResolvedValue({
			reports: [
				{
					id: '11111111-1111-4111-8111-111111111111',
					reason: 'Spam content',
					category: 'request',
					status: 'pending',
					createdAt: '2026-09-01T10:00:00.000Z',
					subjectId: '22222222-2222-4222-8222-222222222222',
				},
			],
			total: 1,
		});
		render(<Reports />);
		expect(await screen.findByText('Spam content')).toBeTruthy();
		expect(screen.getByText('request')).toBeTruthy();
		expect(screen.getByText('pending')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'View report' })).toBeTruthy();
	});

	test('API error shows a retry button that refetches', async () => {
		mockedFetch.mockRejectedValueOnce(new Error('boom'));
		render(<Reports />);
		expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
		mockedFetch.mockResolvedValue({ reports: [], total: 0 });
		fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		expect(await screen.findByText('No reports pending')).toBeTruthy();
		expect(mockedFetch).toHaveBeenCalledTimes(2);
	});

	test('selecting the Requests category filters the queue', async () => {
		mockedFetch.mockResolvedValue({ reports: [], total: 0 });
		render(<Reports />);
		await screen.findByText('No reports pending');
		fireEvent.change(screen.getByLabelText('Filter by category'), {
			target: { value: 'request' },
		});
		await waitFor(() => {
			expect(mockedFetch).toHaveBeenLastCalledWith('test-token', {
				page: 1,
				limit: 25,
				category: 'request',
			});
		});
	});
});
