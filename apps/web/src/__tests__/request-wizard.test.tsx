import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { CategoryStep } from '../components/request-wizard/category-step';
import { ProgressIndicator } from '../components/request-wizard/progress-indicator';
import { TextStep } from '../components/request-wizard/text-step';
import type { Category, WizardStep } from '../components/request-wizard/types';
import { INITIAL_WIZARD_DATA, WIZARD_STEPS } from '../components/request-wizard/types';

afterEach(() => cleanup());

const mockCategories: Category[] = [
	{
		id: 1,
		name: 'Technology',
		slug: 'technology',
		description: 'Computers, software, and tech gear',
		parentId: null,
		retiredAt: null,
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
	},
	{
		id: 2,
		name: 'Education',
		slug: 'education',
		description: 'Learning and tutoring',
		parentId: null,
		retiredAt: null,
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
	},
	{
		id: 3,
		name: 'Health',
		slug: 'health',
		description: null,
		parentId: null,
		retiredAt: null,
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
	},
];

describe('ProgressIndicator', () => {
	test('renders all wizard steps', () => {
		render(<ProgressIndicator currentStep="category" completedSteps={new Set()} />);
		const nav = screen.getByRole('navigation', { name: 'Wizard progress' });
		expect(nav).toBeTruthy();
		const items = screen.getAllByRole('listitem');
		expect(items.length).toBe(WIZARD_STEPS.length);
	});

	test('marks current step with aria-current', () => {
		render(<ProgressIndicator currentStep="goal" completedSteps={new Set()} />);
		const goalItem = screen.getByText('Goal').closest('li');
		expect(goalItem?.getAttribute('aria-current')).toBe('step');
	});

	test('marks completed steps', () => {
		render(
			<ProgressIndicator
				currentStep="barrier"
				completedSteps={new Set<WizardStep>(['category', 'goal'])}
			/>,
		);
		const categoryItem = screen.getByText('Category').closest('li');
		expect(categoryItem?.className).toContain('completed');
	});
});

describe('CategoryStep', () => {
	test('shows loading state when categories are null', () => {
		render(
			<CategoryStep
				categories={null}
				selectedCategoryId={null}
				onSelect={vi.fn()}
				error={null}
				retryLoad={vi.fn()}
			/>,
		);
		expect(screen.getByText('Loading categories...')).toBeTruthy();
	});

	test('shows error with retry button', () => {
		const onRetry = vi.fn();
		render(
			<CategoryStep
				categories={null}
				selectedCategoryId={null}
				onSelect={vi.fn()}
				error="Failed to load categories"
				retryLoad={onRetry}
			/>,
		);
		expect(screen.getByText('Failed to load categories')).toBeTruthy();
		const retryBtn = screen.getByText('Retry');
		fireEvent.click(retryBtn);
		expect(onRetry).toHaveBeenCalled();
	});

	test('renders category list', () => {
		render(
			<CategoryStep
				categories={mockCategories}
				selectedCategoryId={null}
				onSelect={vi.fn()}
				error={null}
				retryLoad={vi.fn()}
			/>,
		);
		expect(screen.getByText('Technology')).toBeTruthy();
		expect(screen.getByText('Education')).toBeTruthy();
		expect(screen.getByText('Health')).toBeTruthy();
	});

	test('shows search input when more than 10 categories', () => {
		const manyCategories = Array.from({ length: 15 }, (_, i) => ({
			...mockCategories[0],
			id: i + 1,
			name: `Category ${i + 1}`,
		}));
		render(
			<CategoryStep
				categories={manyCategories}
				selectedCategoryId={null}
				onSelect={vi.fn()}
				error={null}
				retryLoad={vi.fn()}
			/>,
		);
		expect(screen.getByLabelText('Search categories')).toBeTruthy();
	});

	test('search filters categories', () => {
		cleanup();
		const manyCategories = Array.from({ length: 15 }, (_, i) => ({
			...mockCategories[0],
			id: i + 1,
			name: `Category ${i + 1}`,
		}));
		render(
			<CategoryStep
				categories={manyCategories}
				selectedCategoryId={null}
				onSelect={vi.fn()}
				error={null}
				retryLoad={vi.fn()}
			/>,
		);
		const search = screen.getByLabelText('Search categories');
		fireEvent.change(search, { target: { value: 'Category 1' } });
		expect(screen.getByText('Category 1')).toBeTruthy();
		expect(screen.queryByText('Category 5')).toBeNull();
	});

	test('no match message shown when search has no results', () => {
		cleanup();
		const manyCategories = Array.from({ length: 15 }, (_, i) => ({
			...mockCategories[0],
			id: i + 1,
			name: `Category ${i + 1}`,
		}));
		render(
			<CategoryStep
				categories={manyCategories}
				selectedCategoryId={null}
				onSelect={vi.fn()}
				error={null}
				retryLoad={vi.fn()}
			/>,
		);
		const search = screen.getByLabelText('Search categories');
		fireEvent.change(search, { target: { value: 'xyz' } });
		expect(screen.getByText(/No categories match/)).toBeTruthy();
	});

	test('calls onSelect when category clicked', () => {
		const onSelect = vi.fn();
		render(
			<CategoryStep
				categories={mockCategories}
				selectedCategoryId={null}
				onSelect={onSelect}
				error={null}
				retryLoad={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByText('Technology'));
		expect(onSelect).toHaveBeenCalledWith(1);
	});

	test('shows retired category warning', () => {
		const retiredCategory = { ...mockCategories[0], retiredAt: '2024-06-01T00:00:00Z' };
		render(
			<CategoryStep
				categories={[retiredCategory]}
				selectedCategoryId={1}
				onSelect={vi.fn()}
				error={null}
				retryLoad={vi.fn()}
			/>,
		);
		expect(screen.getByText(/no longer available/)).toBeTruthy();
	});

	test('does not show search when 10 or fewer categories', () => {
		render(
			<CategoryStep
				categories={mockCategories}
				selectedCategoryId={null}
				onSelect={vi.fn()}
				error={null}
				retryLoad={vi.fn()}
			/>,
		);
		expect(screen.queryByLabelText('Search categories')).toBeNull();
	});
});

describe('TextStep', () => {
	test('renders label and textarea', () => {
		render(<TextStep label="What are you trying to accomplish?" value="" onChange={vi.fn()} />);
		expect(
			screen.getByRole('heading', { name: 'What are you trying to accomplish?' }),
		).toBeTruthy();
		expect(screen.getByRole('textbox')).toBeTruthy();
	});

	test('shows error when touched and empty', () => {
		render(<TextStep label="Goal" value="" onChange={vi.fn()} error="Please describe your goal" />);
		const textarea = screen.getByRole('textbox');
		fireEvent.blur(textarea);
		expect(screen.getByText('Please describe your goal')).toBeTruthy();
	});

	test('shows quality hints', () => {
		render(
			<TextStep
				label="Goal"
				value="I need a laptop"
				onChange={vi.fn()}
				qualityHints={['What are you trying to do with the laptop?']}
			/>,
		);
		expect(screen.getByText('What are you trying to do with the laptop?')).toBeTruthy();
	});

	test('shows helper text', () => {
		render(<TextStep label="Help" value="" onChange={vi.fn()} helperText="Describe the problem" />);
		expect(screen.getByText('Describe the problem')).toBeTruthy();
	});

	test('calls onChange with input value', () => {
		const onChange = vi.fn();
		render(<TextStep label="Goal" value="" onChange={onChange} />);
		const textarea = screen.getByRole('textbox');
		fireEvent.change(textarea, { target: { value: 'New goal' } });
		expect(onChange).toHaveBeenCalledWith('New goal');
	});
});

describe('INITIAL_WIZARD_DATA', () => {
	test('has all required fields with default values', () => {
		expect(INITIAL_WIZARD_DATA.title).toBe('');
		expect(INITIAL_WIZARD_DATA.goal).toBe('');
		expect(INITIAL_WIZARD_DATA.barrier).toBe('');
		expect(INITIAL_WIZARD_DATA.helpNeeded).toBe('');
		expect(INITIAL_WIZARD_DATA.categoryId).toBeNull();
		expect(INITIAL_WIZARD_DATA.modality).toBeNull();
	});
});

describe('WIZARD_STEPS', () => {
	test('has 6 steps in correct order', () => {
		expect(WIZARD_STEPS.length).toBe(6);
		expect(WIZARD_STEPS[0].key).toBe('category');
		expect(WIZARD_STEPS[1].key).toBe('goal');
		expect(WIZARD_STEPS[2].key).toBe('barrier');
		expect(WIZARD_STEPS[3].key).toBe('helpNeeded');
		expect(WIZARD_STEPS[4].key).toBe('optionalDetails');
		expect(WIZARD_STEPS[5].key).toBe('preview');
	});
});
