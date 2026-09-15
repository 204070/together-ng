import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lib/server', () => ({
	registerFn: vi.fn(),
	sendOtpFn: vi.fn(),
	verifyOtpFn: vi.fn(),
}));

import { registerFn } from '../lib/server';
import { Route as RegisterRoute } from '../routes/auth/register';

afterEach(() => cleanup());

function renderRegister() {
	const router = createRouter({
		routeTree: RegisterRoute,
		history: createMemoryHistory({ initialEntries: ['/auth/register'] }),
	});
	return render(<RouterProvider router={router} />);
}

describe('Register page', () => {
	test('shows email and phone tabs', async () => {
		renderRegister();
		expect(await screen.findByRole('tab', { name: 'Email' })).toBeTruthy();
		expect(screen.getByRole('tab', { name: 'Phone' })).toBeTruthy();
	});

	test('email form shows name, email, password fields', async () => {
		renderRegister();
		expect(await screen.findByLabelText('Name')).toBeTruthy();
		expect(screen.getByLabelText('Email')).toBeTruthy();
		expect(screen.getByLabelText('Password')).toBeTruthy();
	});

	test('email form shows inline errors for empty submission', async () => {
		renderRegister();
		await screen.findByLabelText('Name');
		const submitBtn = screen.getByRole('button', { name: 'Create account' });
		fireEvent.click(submitBtn);
		expect(await screen.findByText('Name is required')).toBeTruthy();
		expect(screen.getByText('Enter a valid email')).toBeTruthy();
		expect(screen.getByText('Password must be at least 8 characters')).toBeTruthy();
		expect(registerFn).not.toHaveBeenCalled();
	});

	test('email form validates email format', async () => {
		renderRegister();
		await screen.findByLabelText('Name');
		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } });
		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
		fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
		expect(await screen.findByText('Enter a valid email')).toBeTruthy();
		expect(registerFn).not.toHaveBeenCalled();
	});

	test('email form validates password length', async () => {
		renderRegister();
		await screen.findByLabelText('Name');
		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } });
		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } });
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
		fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
		expect(await screen.findByText('Password must be at least 8 characters')).toBeTruthy();
		expect(registerFn).not.toHaveBeenCalled();
	});

	test('switching to phone tab shows phone input', async () => {
		renderRegister();
		await screen.findByRole('tab', { name: 'Email' });
		fireEvent.click(screen.getByRole('tab', { name: 'Phone' }));
		expect(await screen.findByLabelText('Phone number')).toBeTruthy();
	});

	test('phone form validates E.164 format', async () => {
		renderRegister();
		await screen.findByRole('tab', { name: 'Email' });
		fireEvent.click(screen.getByRole('tab', { name: 'Phone' }));
		fireEvent.change(await screen.findByLabelText('Phone number'), {
			target: { value: '123' },
		});
		fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
		expect(
			await screen.findByText('Enter a valid phone number in E.164 format (e.g. +2348012345678)'),
		).toBeTruthy();
	});

	test('shows link to login', async () => {
		renderRegister();
		expect(await screen.findByRole('link', { name: 'Sign in' })).toBeTruthy();
	});

	test('valid email form calls registerFn', async () => {
		vi.mocked(registerFn).mockResolvedValue({} as never);
		renderRegister();
		await screen.findByLabelText('Name');
		fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } });
		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } });
		fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
		fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
		expect(await screen.findByText('Creating account...')).toBeTruthy();
		expect(registerFn).toHaveBeenCalledWith({
			data: { name: 'Alice', email: 'alice@example.com', password: 'password123' },
		});
	});
});
