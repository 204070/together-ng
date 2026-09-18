import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerFn, sendOtpFn, verifyOtpFn } from '../../lib/server';

export const Route = createFileRoute('/auth/register')({
	component: RegisterPage,
	validateSearch: (search: Record<string, unknown>): { returnUrl?: string } => ({
		returnUrl: typeof search.returnUrl === 'string' ? search.returnUrl : undefined,
	}),
});

function RegisterPage() {
	const { returnUrl = '/onboarding' } = Route.useSearch();
	const navigate = useNavigate();
	const [method, setMethod] = useState<'email' | 'phone'>('email');

	return (
		<section>
			<h1>Join Together</h1>
			<div role="tablist" aria-label="Registration method">
				<button
					type="button"
					role="tab"
					aria-selected={method === 'email'}
					onClick={() => setMethod('email')}
				>
					Email
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={method === 'phone'}
					onClick={() => setMethod('phone')}
				>
					Phone
				</button>
			</div>
			{method === 'email' ? (
				<EmailForm returnUrl={returnUrl} navigate={navigate} />
			) : (
				<PhoneForm returnUrl={returnUrl} navigate={navigate} />
			)}
			<p>
				Already have an account? <Link to="/auth/login">Sign in</Link>
			</p>
		</section>
	);
}

function EmailForm({
	returnUrl,
	navigate,
}: {
	returnUrl: string;
	navigate: ReturnType<typeof useNavigate>;
}) {
	const register = useServerFn(registerFn);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	function validate(): boolean {
		const e: Record<string, string> = {};
		if (!name.trim()) e.name = 'Name is required';
		if (!email.trim()) e.email = 'Enter a valid email';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
		if (password.length < 8) e.password = 'Password must be at least 8 characters';
		setErrors(e);
		return Object.keys(e).length === 0;
	}

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setFailure(null);
		if (!validate()) return;
		setSubmitting(true);
		try {
			await register({ data: { name: name.trim(), email: email.trim(), password } });
			await navigate({ to: returnUrl });
		} catch (error) {
			setFailure(error instanceof Error ? error.message : 'Could not register');
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={onSubmit} noValidate>
			<div>
				<label htmlFor="reg-name">Name</label>
				<input
					id="reg-name"
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					aria-invalid={!!errors.name}
				/>
				{errors.name ? <p role="alert">{errors.name}</p> : null}
			</div>
			<div>
				<label htmlFor="reg-email">Email</label>
				<input
					id="reg-email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					aria-invalid={!!errors.email}
				/>
				{errors.email ? <p role="alert">{errors.email}</p> : null}
			</div>
			<div>
				<label htmlFor="reg-password">Password</label>
				<input
					id="reg-password"
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					aria-invalid={!!errors.password}
				/>
				{errors.password ? <p role="alert">{errors.password}</p> : null}
			</div>
			{failure ? <p role="alert">{failure}</p> : null}
			<button type="submit" disabled={submitting}>
				{submitting ? 'Creating account...' : 'Create account'}
			</button>
		</form>
	);
}

function PhoneForm({
	returnUrl,
	navigate,
}: {
	returnUrl: string;
	navigate: ReturnType<typeof useNavigate>;
}) {
	const register = useServerFn(registerFn);
	const sendOtp = useServerFn(sendOtpFn);
	const verifyOtp = useServerFn(verifyOtpFn);
	const [phone, setPhone] = useState('');
	const [otpCode, setOtpCode] = useState('');
	const [otpSent, setOtpSent] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [failure, setFailure] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [resendDisabled, setResendDisabled] = useState(false);
	const [resendCountdown, setResendCountdown] = useState(30);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const startResendTimer = useCallback(() => {
		setResendDisabled(true);
		setResendCountdown(30);
		timerRef.current = setInterval(() => {
			setResendCountdown((prev) => {
				if (prev <= 1) {
					if (timerRef.current) clearInterval(timerRef.current);
					setResendDisabled(false);
					return 30;
				}
				return prev - 1;
			});
		}, 1000);
	}, []);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, []);

	function validatePhone(): boolean {
		const e: Record<string, string> = {};
		if (!/^\+[1-9]\d{1,14}$/.test(phone))
			e.phone = 'Enter a valid phone number in E.164 format (e.g. +2348012345678)';
		setErrors(e);
		return Object.keys(e).length === 0;
	}

	function validateOtp(): boolean {
		const e: Record<string, string> = {};
		if (!/^\d{6}$/.test(otpCode)) e.otp = 'Enter the 6-digit code';
		setErrors(e);
		return Object.keys(e).length === 0;
	}

	async function onSendOtp(event: React.FormEvent) {
		event.preventDefault();
		setFailure(null);
		if (!validatePhone()) return;
		setSubmitting(true);
		try {
			await register({ data: { phone: phone.trim(), password: 'otp-pending' } });
			setOtpSent(true);
			startResendTimer();
		} catch (error) {
			setFailure(error instanceof Error ? error.message : 'Could not register');
		} finally {
			setSubmitting(false);
		}
	}

	async function onVerifyOtp(event: React.FormEvent) {
		event.preventDefault();
		setFailure(null);
		if (!validateOtp()) return;
		setSubmitting(true);
		try {
			await verifyOtp({ data: { phone: phone.trim(), code: otpCode } });
			await navigate({ to: returnUrl });
		} catch (error) {
			setFailure(error instanceof Error ? error.message : 'Invalid code');
		} finally {
			setSubmitting(false);
		}
	}

	async function onResend() {
		setFailure(null);
		try {
			await sendOtp({ data: { phone: phone.trim() } });
			startResendTimer();
		} catch (error) {
			setFailure(error instanceof Error ? error.message : 'Could not resend code');
		}
	}

	return otpSent ? (
		<form onSubmit={onVerifyOtp} noValidate>
			<p>Enter the 6-digit code sent to {phone}</p>
			<div>
				<label htmlFor="otp-code">Code</label>
				<input
					id="otp-code"
					type="text"
					inputMode="numeric"
					maxLength={6}
					value={otpCode}
					onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
					aria-invalid={!!errors.otp}
				/>
				{errors.otp ? <p role="alert">{errors.otp}</p> : null}
			</div>
			{failure ? <p role="alert">{failure}</p> : null}
			<button type="submit" disabled={submitting}>
				{submitting ? 'Verifying...' : 'Verify'}
			</button>
			<button type="button" onClick={onResend} disabled={resendDisabled}>
				{resendDisabled ? `Resend in ${resendCountdown}s` : 'Resend code'}
			</button>
		</form>
	) : (
		<form onSubmit={onSendOtp} noValidate>
			<div>
				<label htmlFor="reg-phone">Phone number</label>
				<input
					id="reg-phone"
					type="tel"
					placeholder="+2348012345678"
					value={phone}
					onChange={(e) => setPhone(e.target.value)}
					aria-invalid={!!errors.phone}
				/>
				{errors.phone ? <p role="alert">{errors.phone}</p> : null}
			</div>
			{failure ? <p role="alert">{failure}</p> : null}
			<button type="submit" disabled={submitting}>
				{submitting ? 'Sending code...' : 'Send verification code'}
			</button>
		</form>
	);
}
