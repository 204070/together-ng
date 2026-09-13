import { jwt } from '@elysiajs/jwt';
import { AuthResponse, SendOtpRequest, UserPrivate, VerifyOtpRequest } from '@together/schemas';
import { type CookieOptions, Elysia, t } from 'elysia';

import { requireActiveActor } from '../../lib/authentication';
import { unauthorizedError, validationError } from '../../lib/errors';
import {
	type AccessTokenSigner,
	checkOtpSendLimit,
	checkOtpVerifyLimit,
	clientIpFrom,
	type IssuedSession,
	loginWithOtp,
	loginWithPassword,
	logoutWithToken,
	refreshWithToken,
	registerUser,
	sendOtpToPhone,
	verifyOtp,
} from './handlers';
import type { AuthServices } from './services';
import { REFRESH_COOKIE_NAME, REFRESH_TTL_SECONDS } from './tokens';
import { toUserPrivate } from './wire';

export function createAuthRouter(services: AuthServices) {
	return new Elysia()
		.use(jwt({ name: 'jwt', secret: services.jwtSecret, exp: '15m' }))
		.post(
			'/auth/register',
			async ({ body, set }) => {
				const user = await registerUser(services, body as Record<string, unknown>);
				set.status = 201;
				return user;
			},
			{
				response: { 201: UserPrivate },
			},
		)
		.post(
			'/auth/otp/send',
			async ({ body }) => {
				checkOtpSendLimit(services, body.phone);
				await sendOtpToPhone(services, body.phone);
				return { sent: true };
			},
			{
				body: SendOtpRequest,
				response: t.Object({ sent: t.Boolean() }),
			},
		)
		.post(
			'/auth/verify-otp',
			async ({ body, request }) => {
				checkOtpVerifyLimit(services, clientIpFrom(request), body.phone);
				await verifyOtp(services, body);
				return { phoneVerified: true };
			},
			{
				body: VerifyOtpRequest,
				response: t.Object({ phoneVerified: t.Boolean() }),
			},
		)
		.post(
			'/auth/login',
			async ({ body, set, jwt: signAccess, request }) => {
				const result = await loginRoute(
					services,
					body as Record<string, unknown>,
					clientIpFrom(request),
					{
						signAccessToken: (payload) => signAccess.sign(payload),
					},
				);
				set.cookie = refreshCookie(services, result.refreshToken);
				return { token: result.accessToken, user: result.user };
			},
			{
				response: { 200: AuthResponse },
			},
		)
		.post(
			'/auth/refresh',
			async ({ cookie, set, jwt: signAccess }) => {
				const raw = cookie[REFRESH_COOKIE_NAME];
				const token = typeof raw?.value === 'string' && raw.value !== '' ? raw.value : undefined;
				if (token === undefined) throw unauthorizedError();
				const result = await refreshWithToken(services, token, (payload) =>
					signAccess.sign(payload),
				);
				set.cookie = refreshCookie(services, result.refreshToken);
				return { token: result.accessToken, user: result.user };
			},
			{
				response: { 200: AuthResponse },
			},
		)
		.post('/auth/logout', async ({ cookie, set }) => {
			const raw = cookie[REFRESH_COOKIE_NAME];
			await logoutWithToken(services, typeof raw?.value === 'string' ? raw.value : undefined);
			set.cookie = clearRefreshCookie();
			set.status = 204;
			return undefined;
		})
		.get(
			'/auth/me',
			async ({ headers, jwt: signAccess }) => {
				const actor = await requireActiveActor(
					headers as { authorization?: string },
					signAccess as never,
					services.store,
				);
				const user = await services.store.findUserById(actor.userId);
				if (user === undefined || user.status !== 'active' || user.deleted_at !== null) {
					throw unauthorizedError();
				}
				return toUserPrivate(user);
			},
			{
				response: { 200: UserPrivate },
			},
		);
}

async function loginRoute(
	services: AuthServices,
	body: Record<string, unknown>,
	ip: string,
	signer: { signAccessToken: AccessTokenSigner },
): Promise<IssuedSession> {
	if (typeof body.email === 'string') {
		return loginWithPassword(
			services,
			{ email: body.email, password: body.password, ip },
			signer.signAccessToken,
		);
	}
	if (typeof body.phone === 'string') {
		return loginWithOtp(
			services,
			{ phone: body.phone, code: body.code, ip },
			signer.signAccessToken,
		);
	}
	throw validationError({ email: 'required', password: 'required' });
}

type RefreshCookie = CookieOptions & { value?: unknown };

function refreshCookie(services: AuthServices, value: string): Record<string, RefreshCookie> {
	return {
		[REFRESH_COOKIE_NAME]: {
			value,
			httpOnly: true,
			sameSite: 'lax',
			secure: services.isProduction,
			path: '/auth',
			maxAge: REFRESH_TTL_SECONDS,
		},
	};
}

function clearRefreshCookie(): Record<string, RefreshCookie> {
	return {
		[REFRESH_COOKIE_NAME]: {
			value: '',
			httpOnly: true,
			sameSite: 'lax',
			path: '/auth',
			maxAge: 0,
			expires: new Date(0),
		},
	};
}
