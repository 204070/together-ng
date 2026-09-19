import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Categories } from './Categories';

vi.mock('../lib/auth', () => ({
	useAuth: () => ({
		session: { token: 'test-token', id: 'admin-1', email: 'admin@example.com' },
		ready: true,
		login: vi.fn(),
		logout: vi.fn(),
	}),
}));

const { fetchAdminCategories, fetchAdminCategoryDetail, createAdminCategory, updateAdminCategory } =
	vi.hoisted(() => ({
		fetchAdminCategories: vi.fn(),
		fetchAdminCategoryDetail: vi.fn(),
		createAdminCategory: vi.fn(),
		updateAdminCategory: vi.fn(),
	}));

vi.mock('../lib/api', () => ({
	ApiError: class ApiError extends Error {
		constructor(
			public readonly status: number,
			public readonly code: string,
			message: string,
		) {
			super(message);
		}
	},
	fetchAdminCategories,
	fetchAdminCategoryDetail,
	createAdminCategory,
	updateAdminCategory,
	createAdminSkill: vi.fn(),
	updateAdminSkill: vi.fn(),
	mergeAdminCategories: vi.fn(),
	relateAdminCategories: vi.fn(),
}));

const parent = {
	id: 1,
	name: 'Gardening',
	slug: 'gardening',
	description: null,
	parentId: null,
	mergedIntoId: null,
	retiredAt: null,
	createdAt: '2026-09-12T10:00:00Z',
	updatedAt: '2026-09-12T10:00:00Z',
	subcategoryCount: 1,
	skillCount: 2,
};

const child = {
	...parent,
	id: 2,
	name: 'Composting',
	slug: 'composting',
	parentId: 1,
	subcategoryCount: 0,
	skillCount: 0,
};

const retired = {
	...parent,
	id: 3,
	name: 'Old Craft',
	slug: 'old-craft',
	retiredAt: '2026-09-13T10:00:00Z',
	subcategoryCount: 0,
	skillCount: 0,
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

beforeEach(() => {
	fetchAdminCategories.mockResolvedValue([parent, child, retired]);
	fetchAdminCategoryDetail.mockResolvedValue({
		...parent,
		subcategories: [child],
		skills: [],
		relatedCategories: [],
	});
});

describe('Categories page', () => {
	test('lists categories with slug, status, and counts, nesting subcategories', async () => {
		render(<Categories />);
		expect(await screen.findByRole('heading', { name: 'Categories' })).toBeTruthy();
		expect(await screen.findByText('Gardening')).toBeTruthy();
		expect(screen.getByText('gardening')).toBeTruthy();
		expect(screen.getByText('Retired')).toBeTruthy();
		expect(screen.getByText('1 subcategories, 2 skills')).toBeTruthy();
		const tree = await screen.findByRole('list', { name: 'Categories' });
		expect(within(tree as HTMLElement).getByText('Composting')).toBeTruthy();
	});

	test('creating a category posts the name and reloads the list', async () => {
		createAdminCategory.mockResolvedValue({ ...parent, id: 9, name: 'Pottery' });
		render(<Categories />);
		await screen.findByText('Gardening');

		fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'Pottery' } });
		fireEvent.click(screen.getByRole('button', { name: 'Add category' }));

		await waitFor(() =>
			expect(createAdminCategory).toHaveBeenCalledWith('test-token', { name: 'Pottery' }),
		);
		expect(fetchAdminCategories).toHaveBeenCalledTimes(2);
	});

	test('selecting a category loads the detail panel with related line and rename', async () => {
		updateAdminCategory.mockResolvedValue({ ...parent, name: 'Gardening!' });
		render(<Categories />);
		await screen.findByText('Gardening');

		fireEvent.click(screen.getAllByRole('button', { name: 'Manage' })[0] as HTMLElement);
		expect(await screen.findByRole('region', { name: 'Manage Gardening' })).toBeTruthy();
		expect(screen.getByText(/^Related:/)).toBeTruthy();

		fireEvent.change(screen.getByLabelText('Rename category'), { target: { value: 'Gardening!' } });
		fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
		await waitFor(() =>
			expect(updateAdminCategory).toHaveBeenCalledWith('test-token', 1, { name: 'Gardening!' }),
		);
	});

	test('a failed load surfaces an alert', async () => {
		fetchAdminCategories.mockRejectedValueOnce(new Error('boom'));
		render(<Categories />);
		expect(await screen.findByRole('alert')).toBeTruthy();
	});
});
