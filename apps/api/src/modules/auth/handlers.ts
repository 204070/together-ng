import {
	checkLoginWithOtp,
	checkLoginWithPassword,
	checkRegisterRequest,
	checkVerifyOtpRequest,
	type UserPrivateType,
} from '@together/schemas';
import {
	emailTakenError,
	invalidCredentialsError,
	invalidOtpError,
	otpAlreadyUsedError,
	otpAttemptsExceededError,
	otpExpiredError,
	phoneNotFoundError,
	phoneNotVerifiedError,
	phoneTakenError,
	rateLimitedError,
	unauthorizedError,
	validationError,
} from './errors';
import type { AuthServices } from './services';
import type { UserRow } from './store';
import {
	generateOtpCode,
	generateRefreshToken,
	hashRefreshToken,
	OTP_TTL_SECONDS,
	REFRESH_TTL_SECONDS,
} from './tokens';
import { toUserPrivate } from './wire';

export function clientIpFrom(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded !== null && forwarded !== '') return forwarded.split(',')[0]?.trim() ?? 'unknown';
	return 'unknown';
}

export function uniqueViolationCode(error: unknown): string | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	const candidate = error as {
		code?: unknown;
		constraint_name?: unknown;
		constraint?: unknown;
		cause?: unknown;
	};
	let target = candidate;
	if (
		candidate.code === undefined &&
		typeof candidate.cause === 'object' &&
		candidate.cause !== null
	) {
		target = candidate.cause as { code?: unknown; constraint_name?: unknown; constraint?: unknown };
	}
	if (target.code !== '23505') return undefined;
	const name =
		typeof target.constraint_name === 'string'
			? target.constraint_name
			: typeof target.constraint === 'string'
				? target.constraint
				: undefined;
	return name;
}

let dummyPasswordHashPromise: Promise<string> | undefined;
function dummyPasswordHash(): Promise<string> {
	dummyPasswordHashPromise ??= Bun.password.hash('together-timing-equalizer', {
		algorithm: 'argon2id',
	});
	return dummyPasswordHashPromise;
}

export type OtpContext = 'verify' | 'login';

export type AccessTokenSigner = (payload: { sub: string; sid: string }) => Promise<string>;

export interface IssuedSession {
	accessToken: string;
	refreshToken: string;
	user: UserPrivateType;
}

interface OtpConsumed {
	userId: string;
	context: OtpContext;
}

async function issueOtp(
	services: AuthServices,
	input: { userId: string; phone: string; context: OtpContext },
): Promise<string> {
	const code = generateOtpCode();
	const codeHash = await Bun.password.hash(code, { algorithm: 'argon2id' });
	const expiresAt = new Date(services.now().getTime() + OTP_TTL_SECONDS * 1000);
	await services.store.deleteOtpsForPhone(input.phone);
	await services.store.insertOtp({
		userId: input.userId,
		phone: input.phone,
		context: input.context,
		codeHash,
		expiresAt,
	});
	await services.otpSender.sendOtp(input.phone, code);
	return code;
}

export async function registerUser(
	services: AuthServices,
	input: Record<string, unknown>,
): Promise<UserPrivateType> {
	const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : input.email;
	const phone = typeof input.phone === 'string' && input.phone !== '' ? input.phone : undefined;
	const value: Record<string, unknown> = { ...input };
	if (email !== undefined) value.email = email;
	else delete value.email;
	const issues = checkRegisterRequest(value);
	if (Object.keys(issues).length > 0) throw validationError(issues);

	if (typeof email === 'string' && email !== '') {
		const existingEmail = await services.store.findUserByEmail(email);
		if (existingEmail !== undefined) throw emailTakenError();
	}
	if (phone !== undefined) {
		const existingPhone = await services.store.findUserByPhone(phone);
		if (existingPhone !== undefined) throw phoneTakenError();
	}

	const passwordHash = await Bun.password.hash(String(input.password), { algorithm: 'argon2id' });
	const effectiveEmail =
		typeof email === 'string' && email !== ''
			? email
			: `phone-${crypto.randomUUID()}@placeholder.together.local`;
	let user: UserRow;
	try {
		user = await services.store.insertUser({
			email: effectiveEmail,
			passwordHash,
			phone: phone ?? null,
		});
	} catch (error) {
		const constraint = uniqueViolationCode(error);
		if (constraint === 'users_email_unique') throw emailTakenError();
		if (constraint === 'users_phone_unique') throw phoneTakenError();
		throw error;
	}

	if (phone !== undefined) {
		await issueOtp(services, { userId: user.id, phone, context: 'verify' });
	}
	return toUserPrivate(user);
}

export async function sendOtpToPhone(services: AuthServices, phone: string): Promise<void> {
	const user = await services.store.findUserByPhone(phone);
	if (user === undefined) throw phoneNotFoundError();
	await issueOtp(services, {
		userId: user.id,
		phone,
		context: user.phoneVerified ? 'login' : 'verify',
	});
}

export async function consumeOtp(
	services: AuthServices,
	phone: string,
	code: string,
): Promise<OtpConsumed> {
	const otp = await services.store.findOtpForPhone(phone);
	if (otp === undefined) throw invalidOtpError();
	if (otp.attempts >= 5) throw otpAttemptsExceededError();
	if (otp.usedAt !== null) throw otpAlreadyUsedError();
	if (otp.expiresAt.getTime() <= services.now().getTime()) throw otpExpiredError();
	if (!(await Bun.password.verify(code, otp.codeHash))) {
		await services.store.incrementOtpAttempts(otp.id);
		throw invalidOtpError();
	}
	await services.store.markOtpUsed(otp.id);
	return { userId: otp.userId, context: otp.context as OtpContext };
}

export async function verifyOtp(
	services: AuthServices,
	input: { phone: string; code: string },
): Promise<void> {
	const issues = checkVerifyOtpRequest(input);
	if (Object.keys(issues).length > 0) throw validationError(issues);
	const { userId } = await consumeOtp(services, input.phone, input.code);
	await services.store.setPhoneVerified(userId);
}

async function issueSession(
	services: AuthServices,
	user: UserRow,
	signAccessToken: AccessTokenSigner,
): Promise<IssuedSession> {
	const refreshToken = generateRefreshToken();
	const expiresAt = new Date(services.now().getTime() + REFRESH_TTL_SECONDS * 1000);
	const session = await services.store.insertSession({
		userId: user.id,
		refreshHash: hashRefreshToken(refreshToken),
		expiresAt,
	});
	const accessToken = await signAccessToken({ sub: user.id, sid: session.id });
	return { accessToken, refreshToken, user: toUserPrivate(user) };
}

export async function loginWithPassword(
	services: AuthServices,
	input: { email: unknown; password: unknown; ip: string },
	signAccessToken: AccessTokenSigner,
): Promise<IssuedSession> {
	const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : input.email;
	const issues = checkLoginWithPassword({ email, password: input.password });
	if (Object.keys(issues).length > 0) throw validationError(issues);

	const limiter = services.limiters.login.check(`login:${input.ip}:${email}`);
	if (!limiter.allowed) throw rateLimitedError('LOGIN_RATE_LIMITED', limiter.retryAfterSeconds);

	const user = await services.store.findUserByEmail(email as string);
	if (user === undefined) {
		await Bun.password.verify(input.password as string, await dummyPasswordHash());
		throw invalidCredentialsError();
	}
	if (user.status !== 'active' || user.deletedAt !== null) throw invalidCredentialsError();
	if (!(await Bun.password.verify(input.password as string, user.passwordHash)))
		throw invalidCredentialsError();
	if (!user.phoneVerified) throw phoneNotVerifiedError();

	await services.store.touchLastLogin(user.id);
	return issueSession(services, user, signAccessToken);
}

export async function loginWithOtp(
	services: AuthServices,
	input: { phone: unknown; code: unknown; ip: string },
	signAccessToken: AccessTokenSigner,
): Promise<IssuedSession> {
	const issues = checkLoginWithOtp({ phone: input.phone, code: input.code });
	if (Object.keys(issues).length > 0) throw validationError(issues);

	const phone = input.phone as string;
	const limiter = services.limiters.login.check(`login:${input.ip}:${phone}`);
	if (!limiter.allowed) throw rateLimitedError('LOGIN_RATE_LIMITED', limiter.retryAfterSeconds);

	const user = await services.store.findUserByPhone(phone);
	if (user === undefined) throw phoneNotVerifiedError();
	if (user.status !== 'active' || user.deletedAt !== null) throw invalidCredentialsError();
	if (!user.phoneVerified) throw phoneNotVerifiedError();

	await consumeOtp(services, phone, input.code as string);
	await services.store.touchLastLogin(user.id);
	return issueSession(services, user, signAccessToken);
}

export async function refreshWithToken(
	services: AuthServices,
	rawRefreshToken: string,
	signAccessToken: AccessTokenSigner,
): Promise<IssuedSession> {
	const refreshHash = hashRefreshToken(rawRefreshToken);
	const session = await services.store.findSessionByRefreshHash(refreshHash);
	if (session === undefined) throw unauthorizedError();
	if (session.expiresAt.getTime() <= services.now().getTime()) {
		await services.store.deleteSessionById(session.id);
		throw unauthorizedError();
	}
	const user = await services.store.findUserById(session.userId);
	if (user === undefined || user.status !== 'active') {
		await services.store.deleteSessionById(session.id);
		throw unauthorizedError();
	}
	await services.store.deleteSessionById(session.id);
	return issueSession(services, user, signAccessToken);
}

export async function logoutWithToken(
	services: AuthServices,
	rawRefreshToken: string | undefined,
): Promise<void> {
	if (rawRefreshToken === undefined || rawRefreshToken === '') return;
	const session = await services.store.findSessionByRefreshHash(hashRefreshToken(rawRefreshToken));
	if (session !== undefined) await services.store.deleteSessionById(session.id);
}

export function checkOtpSendLimit(services: AuthServices, phone: string): void {
	const limiter = services.limiters.otpSend.check(`otp-send:${phone}`);
	if (!limiter.allowed) throw rateLimitedError('OTP_RATE_LIMITED', limiter.retryAfterSeconds);
}

export function checkOtpVerifyLimit(services: AuthServices, ip: string, phone: string): void {
	const limiter = services.limiters.otpVerify.check(`otp-verify:${ip}:${phone}`);
	if (!limiter.allowed)
		throw rateLimitedError('OTP_VERIFY_RATE_LIMITED', limiter.retryAfterSeconds);
}
