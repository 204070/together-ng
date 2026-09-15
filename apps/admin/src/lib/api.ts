import { treaty } from '@elysiajs/eden';
import type { AuthResponseType } from '@together/schemas';
import type { App } from '../../../api/src/app';

/**
 * Eden Treaty client for the same Elysia API the web app calls (Section
 * 65.2). Typed by `App` from `apps/api`, which itself binds
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

export const api = treaty<App>(API_BASE_URL);

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

export interface AdminMe {
	id: string;
	email: string;
	isAdmin: boolean;
}

/**
 * GET /admin/me. Resolves for admins; throws ApiError 403
 * `ADMIN_ACCESS_REQUIRED` ("Admin access required") for valid non-admin
 * tokens and 401 when unauthenticated. This is the call that gates the
 * admin shell after login.
 */
export async function fetchAdminMe(token: string): Promise<AdminMe> {
	const { data, error, status } = await api.admin.me.get(undefined, {
		headers: { authorization: `Bearer ${token}` },
	});
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Admin access required');
	}
	return data;
}

export interface AdminReports {
	reports: unknown[];
	total: number;
}

/** GET /admin/reports placeholder (real queue lands in #19). */
export async function fetchAdminReports(token: string): Promise<AdminReports> {
	const { data, error, status } = await api.admin.reports.get(undefined, {
		headers: { authorization: `Bearer ${token}` },
	});
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Admin access required');
	}
	return { reports: data.reports ?? [], total: data.total ?? 0 };
}
