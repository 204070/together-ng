import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ReportDetailModal } from './ReportDetailModal';

vi.mock('../../lib/api', () => ({
	fetchAdminReportDetail: vi.fn(),
	takeReportAction: vi.fn(),
	ApiError: class ApiError extends Error {
		status: number;
		code: string;
		constructor(status: number, code: string, message: string) {
			super(message);
			this.status = status;
			this.code = code;
		}
	},
}));

vi.mock('../../lib/auth', () => ({
	useAuth: () => ({ session: { token: 'test-token', id: 'admin-1', email: 'a@x.com' } }),
}));

import { fetchAdminReportDetail, takeReportAction } from '../../lib/api';

const mockedDetail = vi.mocked(fetchAdminReportDetail);
const mockedAction = vi.mocked(takeReportAction);

const DETAIL = {
	id: '11111111-1111-4111-8111-111111111111',
	reason: 'Spam content',
	description: null,
	category: 'request',
	status: 'pending',
	createdAt: '2026-09-01T10:00:00.000Z',
	updatedAt: '2026-09-01T10:00:00.000Z',
	subjectId: '22222222-2222-4222-8222-222222222222',
	subjectSnapshot: { id: '22222222-2222-4222-8222-222222222222', title: 'Help me move' },
	resolvedBy: null,
	resolvedAt: null,
} as const;

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

beforeEach(() => {
	mockedDetail.mockReset();
	mockedAction.mockReset();
	mockedDetail.mockResolvedValue(DETAIL);
});

function renderModal() {
	return render(
		<ReportDetailModal reportId={DETAIL.id} onClose={() => {}} onActionComplete={() => {}} />,
	);
}

describe('ReportDetailModal', () => {
	test('shows the reported content snapshot without reporter identity', async () => {
		renderModal();
		expect(await screen.findByText('Reported content')).toBeTruthy();
		expect(screen.getByText(/Help me move/)).toBeTruthy();
		expect(screen.queryByText(/reporter/i)).toBeNull();
	});

	test('offers Warn, Restrict, Suspend, Restore and Dismiss actions', async () => {
		renderModal();
		for (const label of ['Warn', 'Restrict', 'Suspend', 'Restore', 'Dismiss']) {
			expect(await screen.findByRole('button', { name: label })).toBeTruthy();
		}
	});

	test('taking an action disables the buttons until it settles', async () => {
		let resolveAction!: (value: unknown) => void;
		mockedAction.mockReturnValue(
			new Promise((resolve) => {
				resolveAction = resolve as (value: unknown) => void;
			}),
		);
		renderModal();
		const suspend = await screen.findByRole('button', { name: 'Suspend' });
		fireEvent.click(suspend);
		fireEvent.click(suspend);
		expect(mockedAction).toHaveBeenCalledTimes(1);
		expect(mockedAction).toHaveBeenCalledWith('test-token', DETAIL.id, { action: 'suspend' });
		resolveAction({ success: true, report: { ...DETAIL, status: 'resolved' } });
		await waitFor(() => {
			expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull();
		});
	});
});
