import { jwt } from '@elysiajs/jwt';
import {
	AdminMe,
	AdminReports,
	AuditLogResponse,
	ReportActionInput,
	ReportActionResponse,
	ReportDetail,
	ReportStatus,
	ReportSubjectType,
} from '@together/schemas';
import { Elysia, t } from 'elysia';
import { type JwtVerifier, requireActiveUser } from '../../lib/authentication';
import { forbiddenError, HttpError } from '../../lib/errors';
import type { AuthServices } from '../auth/services';
import type { UserRow } from '../auth/store';
import type { AdminService } from './services';

/**
 * Admin authorization boundary (D9 sensitive path). Every admin endpoint
 * first authenticates via the shared D14 JWT flow (`requireActiveUser`:
 * 401 when missing/invalid/expired or the account is not active) and then
 * requires `users.is_admin`: a valid non-admin token gets 403
 * `ADMIN_ACCESS_REQUIRED` ("Admin access required"). Admin responses carry
 * only the fields the admin SPA needs; reporter identity never appears on
 * any admin wire shape either — list/detail responses select explicit
 * columns that exclude `reporter_id`.
 */
export async function requireAdmin(
	headers: { authorization?: string },
	verifier: JwtVerifier,
	store: { findUserById(id: string): Promise<UserRow | undefined> },
): Promise<UserRow> {
	const { user } = await requireActiveUser(headers, verifier, store);
	if (user.isAdmin !== true) throw forbiddenError();
	return user;
}

export interface AdminRouteServices {
	store: { findUserById(id: string): Promise<UserRow | undefined> };
	jwtSecret: string;
	adminService: AdminService;
}

function clientIp(headers: Record<string, string | undefined>): string | null {
	const forwarded = headers['x-forwarded-for'];
	if (forwarded !== undefined) return forwarded.split(',')[0]?.trim() ?? null;
	return headers['x-real-ip'] ?? null;
}

export function createAdminRouter(services: AdminRouteServices | AuthServices) {
	const adminService = 'adminService' in services ? services.adminService : undefined;
	if (!adminService) throw new Error('createAdminRouter requires an AdminService');

	return new Elysia()
		.use(jwt({ name: 'jwt', secret: services.jwtSecret, exp: '15m' }))
		.get(
			'/admin/me',
			async ({ headers, jwt: verifier }) => {
				const user = await requireAdmin(
					headers as { authorization?: string },
					verifier as never,
					services.store,
				);
				return { id: user.id, email: user.email, isAdmin: true };
			},
			{
				response: { 200: AdminMe },
			},
		)
		.get(
			'/admin/reports',
			async ({ headers, jwt: verifier, query }) => {
				await requireAdmin(
					headers as { authorization?: string },
					verifier as never,
					services.store,
				);
				return adminService.listReports(query);
			},
			{
				// Pagination arrives as query strings, so page/limit use
				// t.Numeric coercion (same pattern as the feed routes);
				// status/category are validated against the canonical
				// wire enums from @together/schemas.
				query: t.Object({
					page: t.Optional(t.Numeric({ minimum: 1 })),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
					status: t.Optional(ReportStatus),
					category: t.Optional(ReportSubjectType),
				}),
				response: { 200: AdminReports },
			},
		)
		.get(
			'/admin/reports/:id',
			async ({ headers, jwt: verifier, params }) => {
				await requireAdmin(
					headers as { authorization?: string },
					verifier as never,
					services.store,
				);
				return adminService.getReportDetail(params.id);
			},
			{
				params: t.Object({ id: t.String({ format: 'uuid' }) }),
				response: { 200: ReportDetail },
			},
		)
		.post(
			'/admin/reports/:id/action',
			async ({ headers, jwt: verifier, params, body }) => {
				const admin = await requireAdmin(
					headers as { authorization?: string },
					verifier as never,
					services.store,
				);
				return adminService.actOnReport(
					params.id,
					admin.id,
					body,
					clientIp(headers as Record<string, string | undefined>),
				);
			},
			{
				params: t.Object({ id: t.String({ format: 'uuid' }) }),
				body: ReportActionInput,
				response: { 200: ReportActionResponse },
			},
		)
		.get(
			'/admin/audit-log',
			async ({ headers, jwt: verifier, query }) => {
				await requireAdmin(
					headers as { authorization?: string },
					verifier as never,
					services.store,
				);
				return adminService.listAuditLog(query);
			},
			{
				query: t.Object({
					page: t.Optional(t.Numeric({ minimum: 1 })),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
					actorId: t.Optional(t.String({ format: 'uuid' })),
					entityType: t.Optional(t.String()),
					entityId: t.Optional(t.String({ format: 'uuid' })),
					action: t.Optional(t.String()),
				}),
				response: { 200: AuditLogResponse },
			},
		)
		.patch('/admin/audit-log/:id', async ({ headers, jwt: verifier }) => {
			// The audit log is append-only (Section 50): entries can be
			// listed but never updated. Non-admins still get 403 first.
			await requireAdmin(headers as { authorization?: string }, verifier as never, services.store);
			throw new HttpError(
				405,
				'METHOD_NOT_ALLOWED',
				undefined,
				undefined,
				'Audit log is append-only',
			);
		})
		.delete('/admin/audit-log/:id', async ({ headers, jwt: verifier }) => {
			await requireAdmin(headers as { authorization?: string }, verifier as never, services.store);
			throw new HttpError(
				405,
				'METHOD_NOT_ALLOWED',
				undefined,
				undefined,
				'Audit log is append-only',
			);
		});
}
