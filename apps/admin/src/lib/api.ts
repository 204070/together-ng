import { treaty } from '@elysiajs/eden';
import type { App } from '@together/api';
import type {
	AdminCategoryType,
	AdminMeType as AdminMe,
	AdminReportsType as AdminReports,
	AuditLogQueryType,
	AuditLogResponseType,
	AuthResponseType,
	CategoryDetailType,
	CategoryRelationType,
	CategoryWithCountsType,
	ReportActionInputType,
	ReportActionResponseType,
	ReportDetailType,
	ReportsQueryType,
	SkillType,
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
export type AdminCategoryListItem = CategoryWithCountsType;
export type AdminCategoryDetail = CategoryDetailType;
export type AdminSkill = SkillType;
export type AdminCategoryRelation = CategoryRelationType;
export type AdminCategory = AdminCategoryType;
export type {
	AuditLogQueryType,
	AuditLogResponseType,
	ReportActionInputType,
	ReportActionResponseType,
	ReportDetailType,
	ReportsQueryType,
};

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

/** GET /admin/reports with pagination and filtering. */
export async function fetchAdminReports(
	token: string,
	params?: ReportsQueryType,
): Promise<AdminReports> {
	const { data, error, status } = await api.admin.reports.get({
		query: params,
		headers: { authorization: `Bearer ${token}` },
	});
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Admin access required');
	}
	return data;
}

/** GET /admin/reports/:id for detailed report view. */
export async function fetchAdminReportDetail(token: string, id: string): Promise<ReportDetailType> {
	const { data, error, status } = await api.admin.reports({ id }).get({
		headers: { authorization: `Bearer ${token}` },
	});
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Admin access required');
	}
	return data;
}

/** POST /admin/reports/:id/action to take moderation action. */
export async function takeReportAction(
	token: string,
	id: string,
	body: ReportActionInputType,
): Promise<ReportActionResponseType> {
	const { data, error, status } = await api.admin.reports({ id }).action.post(body, {
		headers: { authorization: `Bearer ${token}` },
	});
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Admin access required');
	}
	return data;
}

/** GET /admin/audit-log with pagination and filtering. */
export async function fetchAuditLog(
	token: string,
	params?: AuditLogQueryType,
): Promise<AuditLogResponseType> {
	const { data, error, status } = await api.admin['audit-log'].get({
		query: params,
		headers: { authorization: `Bearer ${token}` },
	});
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Admin access required');
	}
	return data;
}

function authHeaders(token: string) {
	return { headers: { authorization: `Bearer ${token}` } };
}

/** GET /admin/categories — full list with subcategory/skill counts (Eden Treaty). */
export async function fetchAdminCategories(token: string): Promise<AdminCategoryListItem[]> {
	const { data, error, status } = await api.admin.categories.get(authHeaders(token));
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Could not load categories');
	}
	return data;
}

/** POST /admin/categories — create a top-level category or a subcategory. */
export async function createAdminCategory(
	token: string,
	input: { name: string; description?: string | null; parentId?: number | null },
): Promise<AdminCategory> {
	const { data, error, status } = await api.admin.categories.post(input, authHeaders(token));
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Could not create category');
	}
	return data;
}

/** GET /admin/categories/:id — detail with subcategories, skills, related. */
export async function fetchAdminCategoryDetail(
	token: string,
	id: number,
): Promise<AdminCategoryDetail> {
	const { data, error, status } = await api.admin
		.categories({ id: String(id) })
		.get(authHeaders(token));
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Could not load category');
	}
	return data;
}

/** PATCH /admin/categories/:id — rename, edit description, retire/restore. */
export async function updateAdminCategory(
	token: string,
	id: number,
	patch: { name?: string; description?: string | null; retiredAt?: string | null },
): Promise<AdminCategory> {
	const { data, error, status } = await api.admin
		.categories({ id: String(id) })
		.patch(patch, authHeaders(token));
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Could not update category');
	}
	return data;
}

/** POST /admin/categories/:id/merge — reassign content to target, retire source. */
export async function mergeAdminCategories(
	token: string,
	id: number,
	targetId: number,
): Promise<AdminCategory> {
	const { data, error, status } = await api.admin
		.categories({ id: String(id) })
		.merge.post({ targetId }, authHeaders(token));
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Could not merge categories');
	}
	return data;
}

/** POST /admin/categories/:id/related — link two related categories. */
export async function relateAdminCategories(
	token: string,
	id: number,
	relatedId: number,
): Promise<AdminCategoryRelation> {
	const { data, error, status } = await api.admin
		.categories({ id: String(id) })
		.related.post({ relatedId }, authHeaders(token));
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Could not link categories');
	}
	return data;
}

/** POST /admin/categories/:id/skills — add a skill under a category. */
export async function createAdminSkill(
	token: string,
	categoryId: number,
	name: string,
): Promise<AdminSkill> {
	const { data, error, status } = await api.admin
		.categories({ id: String(categoryId) })
		.skills.post({ name }, authHeaders(token));
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Could not create skill');
	}
	return data;
}

/** PATCH /admin/skills/:id — rename or retire/restore a skill. */
export async function updateAdminSkill(
	token: string,
	id: number,
	patch: { name?: string; retiredAt?: string | null },
): Promise<AdminSkill> {
	const { data, error, status } = await api.admin
		.skills({ id: String(id) })
		.patch(patch, authHeaders(token));
	if (error !== null || data === null) {
		throw toApiError(status, error?.value, 'Could not update skill');
	}
	return data;
}
