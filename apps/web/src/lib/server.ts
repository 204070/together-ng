import { createServerFn } from '@tanstack/react-start';
import { createApiClient } from './api';

// All API access in loaders/mutations goes through these server functions so
// it always executes on the server (SSR for first paint, same-origin RPC for
// client navigations — no CORS, no client-side feed fetch). Dynamic imports
// keep node-only modules (@together/config, server request helpers) out of
// the client bundle: they run exclusively inside server handlers.

const TOKEN_COOKIE = 'together_token';

async function apiBaseUrl(): Promise<string> {
	if (process.env.API_URL) return process.env.API_URL;
	const { loadEnv } = await import('@together/config');
	return `http://localhost:${loadEnv().PORT}`;
}

// Authorization for the upstream API call: prefer the incoming Authorization
// header verbatim; otherwise build one from the login cookie the browser
// sends automatically on SSR and server-function calls.
async function incomingAuth(): Promise<string | undefined> {
	const { getRequestHeader } = await import('@tanstack/react-start/server');
	const direct = getRequestHeader('authorization');
	if (direct !== undefined && direct !== '') return direct;
	const cookie = getRequestHeader('cookie');
	if (cookie === undefined) return undefined;
	const match = new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]+)`).exec(cookie);
	const token = match?.[1];
	if (token === undefined || token === '') return undefined;
	return `Bearer ${decodeURIComponent(token)}`;
}

async function incomingRefreshToken(): Promise<string | undefined> {
	const { getRequestHeader } = await import('@tanstack/react-start/server');
	const cookie = getRequestHeader('cookie');
	if (cookie === undefined) return undefined;
	const match = /(?:^|;\s*)together_refresh=([^;]+)/.exec(cookie);
	const token = match?.[1];
	if (token === undefined || token === '') return undefined;
	return decodeURIComponent(token);
}

export const getFeaturedFn = createServerFn({ method: 'GET' }).handler(async () => {
	const api = createApiClient(await apiBaseUrl());
	const { data, error } = await api.requests.featured.get();
	if (error !== null || data === null) throw new Error('Feed unavailable');
	return data;
});

export const getAuthUserFn = createServerFn({ method: 'GET' }).handler(async () => {
	const authorization = await incomingAuth();
	const api = createApiClient(await apiBaseUrl());

	if (authorization !== undefined) {
		try {
			const headers = { authorization };
			const me = await api.auth.me.get({ headers });
			if (me.error === null && me.data !== null) {
				const profile = await api.profiles.me.get({ headers });
				return {
					user: me.data,
					profile: profile.error !== null || profile.data === null ? null : profile.data,
				};
			}
		} catch {
			// Access token might be expired or invalid, fall through to refresh rotation
		}
	}

	// Access token missing or rejected; attempt rotating refresh token if present
	const refreshToken = await incomingRefreshToken();
	if (refreshToken === undefined) {
		return { user: null, profile: null };
	}

	try {
		const refreshRes = await api.auth.refresh.post(
			{},
			{ headers: { cookie: `together_refresh=${encodeURIComponent(refreshToken)}` } },
		);
		if (refreshRes.error !== null || refreshRes.data === null) {
			return { user: null, profile: null };
		}

		const newAccessToken = refreshRes.data.token;
		const user = refreshRes.data.user;

		const { setCookie, setResponseHeader } = await import('@tanstack/react-start/server');
		setCookie('together_token', newAccessToken, { path: '/', maxAge: 900 });

		const rawSetCookie = refreshRes.response.headers.get('set-cookie');
		const match = /(?:^|;\s*)together_refresh=([^;]+)/.exec(rawSetCookie || '');
		const tokenInCookie = match?.[1];
		const newRefreshToken = tokenInCookie ? decodeURIComponent(tokenInCookie) : refreshToken;
		setCookie('together_refresh', newRefreshToken, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 30 * 24 * 60 * 60,
		});
		if (rawSetCookie) {
			try {
				setResponseHeader('Set-Cookie', rawSetCookie.replace(/Path=\/auth/i, 'Path=/'));
			} catch {}
		}

		const profile = await api.profiles.me.get({
			headers: { authorization: `Bearer ${newAccessToken}` },
		});
		return {
			user,
			profile: profile.error !== null || profile.data === null ? null : profile.data,
		};
	} catch {
		return { user: null, profile: null };
	}
});

export type AuthState = Awaited<ReturnType<typeof getAuthUserFn>>;

export const getRequestDetailFn = createServerFn({ method: 'GET' })
	.validator((id: unknown) => {
		if (typeof id !== 'string' || id === '') throw new Error('Invalid request id');
		return id;
	})
	.handler(async ({ data: id }) => {
		try {
			const authorization = await incomingAuth();
			const api = createApiClient(await apiBaseUrl());
			const res = await api
				.requests({ id })
				.get(authorization ? { headers: { authorization } } : undefined);
			if (res.error !== null || res.data === null) return { request: null };
			return { request: res.data };
		} catch {
			return { request: null };
		}
	});

export const createRequestFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		const value = input as { title?: unknown; goal?: unknown };
		if (typeof value?.title !== 'string' || value.title.trim() === '') {
			throw new Error('Title is required');
		}
		return { title: value.title.trim(), goal: typeof value.goal === 'string' ? value.goal : '' };
	})
	.handler(async ({ data }) => {
		const authorization = await incomingAuth();
		if (authorization === undefined) throw new Error('Sign in to create a request');
		const api = createApiClient(await apiBaseUrl());
		const res = await api.requests.post(
			{ title: data.title, goal: data.goal },
			{ headers: { authorization } },
		);
		if (res.error !== null || res.data === null) throw new Error('Could not create request');
		return res.data;
	});

export const loginFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		const value = input as { email?: unknown; password?: unknown };
		if (typeof value?.email !== 'string' || typeof value?.password !== 'string') {
			throw new Error('Email and password are required');
		}
		return { email: value.email, password: value.password };
	})
	.handler(async ({ data }) => {
		const api = createApiClient(await apiBaseUrl());
		const res = await api.auth.login.post({ email: data.email, password: data.password });
		if (res.error !== null || res.data === null) throw new Error('Invalid email or password');

		const rawSetCookie = res.response.headers.get('set-cookie');
		const match = /(?:^|;\s*)together_refresh=([^;]+)/.exec(rawSetCookie || '');
		const refreshToken = match?.[1] ? decodeURIComponent(match[1]) : undefined;
		if (refreshToken) {
			const { setCookie, setResponseHeader } = await import('@tanstack/react-start/server');
			setCookie('together_refresh', refreshToken, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 30 * 24 * 60 * 60,
			});
			if (rawSetCookie) {
				try {
					setResponseHeader('Set-Cookie', rawSetCookie.replace(/Path=\/auth/i, 'Path=/'));
				} catch {}
			}
		}

		return res.data;
	});

export const registerFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		const value = input as { email?: unknown; password?: unknown };
		if (typeof value?.email !== 'string' || typeof value?.password !== 'string') {
			throw new Error('Email and password are required');
		}
		return { email: value.email, password: value.password };
	})
	.handler(async ({ data }) => {
		const api = createApiClient(await apiBaseUrl());
		const res = await api.auth.register.post({ email: data.email, password: data.password });
		if (res.error !== null || res.data === null) throw new Error('Could not register');
		return res.data;
	});
