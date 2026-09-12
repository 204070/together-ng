export interface ErrorBody {
	error: string;
	message?: string;
	fields?: Record<string, string>;
}

export class HttpError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		public readonly fields?: Record<string, string>,
		public readonly retryAfterSeconds?: number,
		public readonly messageOverride?: string,
	) {
		super(code);
	}

	body(): ErrorBody {
		const body: ErrorBody = { error: this.code };
		if (this.fields !== undefined) body.fields = this.fields;
		if (this.messageOverride !== undefined) body.message = this.messageOverride;
		return body;
	}
}

export const validationError = (fields: Record<string, string>): HttpError =>
	new HttpError(400, 'VALIDATION', fields, undefined, 'Invalid request');

export const emailTakenError = (): HttpError =>
	new HttpError(
		409,
		'EMAIL_TAKEN',
		{ email: 'taken' },
		undefined,
		'An account with this email already exists',
	);

export const phoneTakenError = (): HttpError =>
	new HttpError(
		409,
		'PHONE_TAKEN',
		{ phone: 'taken' },
		undefined,
		'An account with this phone already exists',
	);

export const invalidCredentialsError = (): HttpError =>
	new HttpError(401, 'INVALID_CREDENTIALS', undefined, undefined, 'Email or password is incorrect');

export const phoneNotVerifiedError = (): HttpError =>
	new HttpError(403, 'PHONE_NOT_VERIFIED', undefined, undefined, 'Phone number is not verified');

export const invalidOtpError = (): HttpError =>
	new HttpError(401, 'INVALID_OTP', undefined, undefined, 'Invalid verification code');

export const otpExpiredError = (): HttpError =>
	new HttpError(410, 'OTP_EXPIRED', undefined, undefined, 'Verification code has expired');

export const otpAlreadyUsedError = (): HttpError =>
	new HttpError(
		400,
		'OTP_ALREADY_USED',
		undefined,
		undefined,
		'Verification code has already been used',
	);

export const otpAttemptsExceededError = (): HttpError =>
	new HttpError(
		429,
		'OTP_ATTEMPTS_EXCEEDED',
		undefined,
		undefined,
		'Too many incorrect attempts, request a fresh code',
	);

export const phoneNotFoundError = (): HttpError =>
	new HttpError(
		404,
		'PHONE_NOT_FOUND',
		undefined,
		undefined,
		'No account found for this phone number',
	);

export const unauthorizedError = (): HttpError =>
	new HttpError(401, 'UNAUTHORIZED', undefined, undefined, 'Authentication required');

export const rateLimitedError = (code: string, retryAfterSeconds: number): HttpError =>
	new HttpError(429, code, undefined, retryAfterSeconds, 'Too many requests, try again later');
