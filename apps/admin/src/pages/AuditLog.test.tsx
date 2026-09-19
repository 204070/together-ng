import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AuditLog } from './AuditLog';

vi.mock('../lib/api', () => ({
	fetchAuditLog: vi.fn(),
}));

vi.mock('../lib/auth', () => ({
	useAuth: () => ({ session: { token: 'test-token', id: 'admin-1', email: 'a@x.com' } }),
}));

import { fetchAuditLog } from '../lib/api';

const mockedFetch = vi.mocked(fetchAuditLog);

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

beforeEach(() => {
	mockedFetch.mockReset();
});

describe('AuditLog viewer', () => {
	test('shows a loading skeleton while fetching', () => {
		mockedFetch.mockReturnValue(new Promise(() => {}));
		render(<AuditLog />);
		expect(screen.getByLabelText('Loading audit log')).toBeTruthy();
	});

	test('shows an empty state when there are no entries', async () => {
		mockedFetch.mockResolvedValue({ entries: [], total: 0, page: 1, limit: 25 });
		render(<AuditLog />);
		expect(await screen.findByText('No audit entries')).toBeTruthy();
	});

	test('lists entries with actor, action and target', async () => {
		mockedFetch.mockResolvedValue({
			entries: [
				{
					id: 1,
					actorId: 'admin-1',
					actorEmail: 'admin@example.com',
					action: 'suspend',
					entityType: 'report',
					entityId: '11111111-1111-4111-8111-111111111111',
					before: null,
					after: null,
					ipAddress: null,
					createdAt: '2026-09-01T10:00:00.000Z',
				},
			],
			total: 1,
			page: 1,
			limit: 25,
		});
		render(<AuditLog />);
		expect(await screen.findByText('admin@example.com')).toBeTruthy();
		expect(screen.getByText('suspend')).toBeTruthy();
		expect(screen.getByText('11111111-1111-4111-8111-111111111111')).toBeTruthy();
	});

	test('API error shows a retry button that refetches', async () => {
		mockedFetch.mockRejectedValueOnce(new Error('boom'));
		render(<AuditLog />);
		expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
		mockedFetch.mockResolvedValue({ entries: [], total: 0, page: 1, limit: 25 });
		fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		expect(await screen.findByText('No audit entries')).toBeTruthy();
		expect(mockedFetch).toHaveBeenCalledTimes(2);
	});
});
