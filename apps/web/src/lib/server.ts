import { createServerFn } from '@tanstack/react-start';
import type { ProfileCreateType, ProfilePatchType } from '@together/schemas';
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

export interface FeedFilterParams {
	sort?: string;
	categoryId?: string;
	category?: string;
	modality?: string;
	online?: string | boolean;
	helpType?: string;
	location?: string;
	page?: string | number;
	limit?: string | number;
}

export interface CategoryFeedParams extends FeedFilterParams {
	slug: string;
}

export interface SearchRequestsParams extends FeedFilterParams {
	q: string;
}

export interface FeaturedQueryWire {
	sort?: string;
	categoryId?: string;
	category?: string;
	modality?: string;
	online?: string;
	helpType?: string;
	location?: string;
	page?: string;
	limit?: string;
}

export interface SearchQueryWire extends FeaturedQueryWire {
	q: string;
}

function buildQueryParams(data: FeedFilterParams): FeaturedQueryWire {
	const query: FeaturedQueryWire = {};
	if (data.sort) query.sort = String(data.sort);
	if (data.categoryId) query.categoryId = String(data.categoryId);
	if (data.category) query.category = String(data.category);
	if (data.modality) query.modality = String(data.modality);
	if (data.online !== undefined && data.online !== '') query.online = String(data.online);
	if (data.helpType) query.helpType = String(data.helpType);
	if (data.location?.trim()) query.location = data.location.trim();
	if (data.page !== undefined && data.page !== '') query.page = String(data.page);
	if (data.limit !== undefined && data.limit !== '') query.limit = String(data.limit);
	return query;
}

export const getFeaturedFn = createServerFn({ method: 'GET' })
	.validator((input?: unknown) => {
		const parsed = (
			input && typeof input === 'object' && 'data' in input
				? (input as { data: unknown }).data
				: input
		) as FeedFilterParams | undefined;
		return parsed ?? {};
	})
	.handler(async ({ data }) => {
		const api = createApiClient(await apiBaseUrl());
		const query = buildQueryParams(data);
		const { data: resData, error } = await api.requests.featured.get({
			query: (Object.keys(query).length > 0 ? query : undefined) as never,
		});
		if (error !== null || resData === null) throw new Error('Feed unavailable');
		return resData;
	});

export const getCategoryFeedFn = createServerFn({ method: 'GET' })
	.validator((input: unknown) => {
		const parsed = (
			input && typeof input === 'object' && 'data' in input
				? (input as { data: unknown }).data
				: input
		) as CategoryFeedParams;
		if (!parsed || typeof parsed.slug !== 'string' || parsed.slug === '') {
			throw new Error('Category slug is required');
		}
		return parsed;
	})
	.handler(async ({ data }) => {
		const api = createApiClient(await apiBaseUrl());
		const query = buildQueryParams(data);
		const res = await api.categories({ id: data.slug }).requests.get({
			query: (Object.keys(query).length > 0 ? query : undefined) as never,
		});
		if (res.error !== null || res.data === null) {
			throw new Error('Category feed unavailable');
		}
		return res.data;
	});

export const searchRequestsFn = createServerFn({ method: 'GET' })
	.validator((input: unknown) => {
		const parsed = (
			input && typeof input === 'object' && 'data' in input
				? (input as { data: unknown }).data
				: input
		) as SearchRequestsParams;
		if (!parsed || typeof parsed.q !== 'string') {
			throw new Error('Search query is required');
		}
		return parsed;
	})
	.handler(async ({ data }) => {
		const api = createApiClient(await apiBaseUrl());
		const query: SearchQueryWire = { q: data.q, ...buildQueryParams(data) };
		const res = await api.requests.search.get({
			query: query as never,
		});
		if (res.error !== null || res.data === null) {
			throw new Error('Search unavailable');
		}
		return res.data;
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

export const getCategoriesFn = createServerFn({ method: 'GET' }).handler(async () => {
	const api = createApiClient(await apiBaseUrl());
	const res = await api.categories.get();
	if (res.error !== null || res.data === null) throw new Error('Could not load categories');
	return res.data;
});

export const createDraftFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		const value = input as Record<string, unknown>;
		return value;
	})
	.handler(async ({ data }) => {
		const authorization = await incomingAuth();
		if (authorization === undefined) throw new Error('Sign in to create a request');
		const api = createApiClient(await apiBaseUrl());
		const res = await api.requests.post(data as never, { headers: { authorization } });
		if (res.error !== null || res.data === null) throw new Error('Could not create draft');
		return res.data;
	});

export const updateDraftFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		const value = input as { id?: unknown; patch?: unknown };
		if (typeof value?.id !== 'string' || value.id === '') {
			throw new Error('Request id is required');
		}
		return { id: value.id, patch: (value.patch as Record<string, unknown>) ?? {} };
	})
	.handler(async ({ data }) => {
		const authorization = await incomingAuth();
		if (authorization === undefined) throw new Error('Sign in to update a request');
		const api = createApiClient(await apiBaseUrl());
		const res = await api
			.requests({ id: data.id })
			.patch(data.patch, { headers: { authorization } });
		if (res.error !== null || res.data === null) throw new Error('Could not update draft');
		return res.data;
	});

export const getDraftFn = createServerFn({ method: 'GET' })
	.validator((input: unknown) => {
		if (typeof input !== 'string' || input === '') {
			throw new Error('Request id is required');
		}
		return input;
	})
	.handler(async ({ data: id }) => {
		const authorization = await incomingAuth();
		if (authorization === undefined) throw new Error('Sign in to view a draft');
		const api = createApiClient(await apiBaseUrl());
		const res = await api.requests({ id }).get({ headers: { authorization } });
		if (res.error !== null || res.data === null) throw new Error('Draft not found');
		return res.data;
	});

export const getPreviewFn = createServerFn({ method: 'GET' })
	.validator((input: unknown) => {
		if (typeof input !== 'string' || input === '') {
			throw new Error('Request id is required');
		}
		return input;
	})
	.handler(async ({ data: id }) => {
		const authorization = await incomingAuth();
		if (authorization === undefined) throw new Error('Sign in to preview a request');
		const api = createApiClient(await apiBaseUrl());
		const res = await api.requests({ id }).preview.get({ headers: { authorization } });
		if (res.error !== null || res.data === null) throw new Error('Could not load preview');
		const { missingFields, qualityHints, isPublishable, ...request } = res.data;
		return {
			request: {
				...request,
				qualityHints: qualityHints ?? [],
			},
			missingFields: missingFields ?? [],
			qualityHints: qualityHints ?? [],
			isPublishable,
		};
	});

export const publishRequestFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		if (typeof input !== 'string' || input === '') {
			throw new Error('Request id is required');
		}
		return input;
	})
	.handler(async ({ data: id }) => {
		const authorization = await incomingAuth();
		if (authorization === undefined) throw new Error('Sign in to publish a request');
		const api = createApiClient(await apiBaseUrl());
		const res = await api.requests({ id }).publish.post(undefined, { headers: { authorization } });
		if (res.error !== null || res.data === null) {
			const errorData = res.error as { fields?: Record<string, string> } | null;
			if (errorData?.fields) {
				throw new Error(JSON.stringify({ fields: errorData.fields }));
			}
			throw new Error('Could not publish request');
		}
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
		const value = input as { email?: unknown; password?: unknown; name?: unknown; phone?: unknown };
		const hasEmail = typeof value?.email === 'string' && value.email !== '';
		const hasPhone = typeof value?.phone === 'string' && value.phone !== '';
		if (!hasEmail && !hasPhone) {
			throw new Error('Email or phone is required');
		}
		if (typeof value?.password !== 'string' || value.password.length < 8) {
			throw new Error('Password must be at least 8 characters');
		}
		return {
			email: hasEmail ? (value.email as string) : undefined,
			password: value.password as string,
			name: typeof value.name === 'string' ? value.name : undefined,
			phone: hasPhone ? (value.phone as string) : undefined,
		};
	})
	.handler(async ({ data }) => {
		const api = createApiClient(await apiBaseUrl());
		const body: Record<string, string> = { password: data.password };
		if (data.email) body.email = data.email;
		if (data.name) body.name = data.name;
		if (data.phone) body.phone = data.phone;
		const res = await api.auth.register.post(body);
		if (res.error !== null || res.data === null) throw new Error('Could not register');
		return res.data;
	});

export const sendOtpFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		const value = input as { phone?: unknown };
		if (typeof value?.phone !== 'string') throw new Error('Phone is required');
		return { phone: value.phone };
	})
	.handler(async ({ data }) => {
		const api = createApiClient(await apiBaseUrl());
		const res = await api.auth.otp.send.post({ phone: data.phone });
		if (res.error !== null || res.data === null) throw new Error('Could not send OTP');
		return res.data;
	});

export const verifyOtpFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		const value = input as { phone?: unknown; code?: unknown };
		if (typeof value?.phone !== 'string' || typeof value?.code !== 'string') {
			throw new Error('Phone and code are required');
		}
		return { phone: value.phone, code: value.code };
	})
	.handler(async ({ data }) => {
		const api = createApiClient(await apiBaseUrl());
		const res = await api.auth['verify-otp'].post({ phone: data.phone, code: data.code });
		if (res.error !== null || res.data === null) throw new Error('Invalid code');
		return res.data;
	});

export const createProfileFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		const value = input as Record<string, unknown>;
		if (typeof value?.name !== 'string' || value.name.trim() === '') {
			throw new Error('Name is required');
		}
		return {
			name: value.name,
			location: typeof value.location === 'string' ? value.location : null,
			description: typeof value.description === 'string' ? value.description : null,
			photoUrl: typeof value.photoUrl === 'string' ? value.photoUrl : null,
			areasOfInterest: Array.isArray(value.areasOfInterest)
				? (value.areasOfInterest as number[])
				: [],
			skills: Array.isArray(value.skills) ? (value.skills as number[]) : [],
			resources: Array.isArray(value.resources) ? (value.resources as string[]) : [],
			contributionAvailability: (value.contributionAvailability ??
				null) as ProfileCreateType['contributionAvailability'],
			exactAddress: typeof value.exactAddress === 'string' ? value.exactAddress : null,
		};
	})
	.handler(async ({ data }) => {
		const authorization = await incomingAuth();
		if (authorization === undefined) throw new Error('Sign in to create a profile');
		const api = createApiClient(await apiBaseUrl());
		const payload: ProfileCreateType = {
			name: data.name,
			location: data.location,
			description: data.description,
			photoUrl: data.photoUrl,
			areasOfInterest: data.areasOfInterest,
			skills: data.skills,
			resources: data.resources,
			contributionAvailability: data.contributionAvailability,
			exactAddress: data.exactAddress,
		};
		const res = await api.profiles.post(payload, { headers: { authorization } });
		if (res.error !== null || res.data === null) throw new Error('Could not create profile');
		return res.data;
	});

export const updateProfileFn = createServerFn({ method: 'POST' })
	.validator((input: unknown) => {
		const value = input as { id?: unknown; [key: string]: unknown };
		if (typeof value?.id !== 'string') throw new Error('Profile id is required');
		return {
			id: value.id,
			name: typeof value.name === 'string' ? value.name : undefined,
			location: typeof value.location === 'string' ? value.location : undefined,
			description: typeof value.description === 'string' ? value.description : undefined,
			photoUrl: typeof value.photoUrl === 'string' ? value.photoUrl : undefined,
			areasOfInterest: Array.isArray(value.areasOfInterest)
				? (value.areasOfInterest as number[])
				: undefined,
			skills: Array.isArray(value.skills) ? (value.skills as number[]) : undefined,
			resources: Array.isArray(value.resources) ? (value.resources as string[]) : undefined,
			contributionAvailability:
				value.contributionAvailability as ProfilePatchType['contributionAvailability'],
			exactAddress: typeof value.exactAddress === 'string' ? value.exactAddress : undefined,
		};
	})
	.handler(async ({ data }) => {
		const authorization = await incomingAuth();
		if (authorization === undefined) throw new Error('Sign in to update a profile');
		const api = createApiClient(await apiBaseUrl());
		const { id, ...patch } = data;
		const payload: ProfilePatchType = patch;
		const res = await api.profiles({ id }).patch(payload, { headers: { authorization } });
		if (res.error !== null || res.data === null) throw new Error('Could not update profile');
		return res.data;
	});

export const getSkillsForCategoryFn = createServerFn({ method: 'GET' })
	.validator((input: unknown) => {
		if (typeof input !== 'number') throw new Error('Category id is required');
		return input;
	})
	.handler(async ({ data: categoryId }) => {
		const api = createApiClient(await apiBaseUrl());
		const { data, error } = await api.categories({ id: categoryId }).skills.get();
		if (error !== null || data === null) throw new Error('Skills unavailable');
		return data;
	});
