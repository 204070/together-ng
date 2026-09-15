import { treaty } from '@elysiajs/eden';
import type { App } from '@together/api';
import type {
	AdminMeType as AdminMe,
	AdminReportsType as AdminReports,
	AuthResponseType,
} from '@together/schemas';

/**
 * Eden Treaty client for the same Elysia API the web app calls (Section
 * 65.2). Typed by `App` from `@together/api`, which itself binds
 * `packages/schemas` wire shapes — a schema change that alters the login
 * or admin responses breaks `typecheck` here.
 *
 * The SPA authenticates with the shared D14 flow: `POST /auth/login`
 * returns a short-lived Bearer JWT, and every admin call carries it as
 * `Authorization: Bearer <token>`. Admin-only routes (`/admin/*`) answer
 * 403 `ADMIN_ACCESS_REQUIRED` to valid non-admin tokens.
 */
export const API_BASE_URL =
	(import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

export const api = treaty<App>(API_BASE_URL, {
	fetch: {
		credentials: 'include',
	},
});

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
	) {
		super(message);
	}
}

function toApiError(status: number, value: unknown, fallback: string): ApiError {
	if (typeof value === 'object' && value !== null) {
		const body = value as { error?: unknown; message?: unknown };
		const code = typeof body.error === 'string' ? body.error : `HTTP_${status}`;
		const message = typeof body.message === 'string' ? body.message : fallback;
		return new ApiError(status, code, message);
	}
	return new ApiError(status, `HTTP_${status}`, fallback);
}

/** POST /auth/login with email + password. Throws ApiError on failure. */
export async function loginWithPassword(
	email: string,
	password: string,
): Promise<AuthResponseType> {
	const { data, error, status } = await api.auth.login.post({ email, password });
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Email or password is incorrect');
	}
	return data;
}

/** POST /auth/refresh with rotating httpOnly refresh cookie. */
export async function refreshAdminToken(): Promise<string> {
	const { data, error, status } = await api.auth.refresh.post();
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Failed to refresh token');
	}
	return data.token;
}

export type { AdminMe, AdminReports };

/**
 * GET /admin/me. Resolves for admins; throws ApiError 403
 * `ADMIN_ACCESS_REQUIRED` ("Admin access required") for valid non-admin
 * tokens and 401 when unauthenticated. This is the call that gates the
 * admin shell after login.
 */
export async function fetchAdminMe(token: string): Promise<AdminMe> {
	const { data, error, status } = await api.admin.me.get({
		headers: { authorization: `Bearer ${token}` },
	});
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Admin access required');
	}
	return data;
}

/** GET /admin/reports placeholder (real queue lands in #19). */
export async function fetchAdminReports(token: string): Promise<AdminReports> {
	const { data, error, status } = await api.admin.reports.get({
		headers: { authorization: `Bearer ${token}` },
	});
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Admin access required');
	}
	return { reports: (data.reports as unknown[]) ?? [], total: data.total ?? 0 };
}
