import { jwt } from '@elysiajs/jwt';
import { AdminMe, AdminReports } from '@together/schemas';
import { Elysia } from 'elysia';
import { type JwtVerifier, requireActiveUser } from '../../lib/authentication';
import { forbiddenError } from '../../lib/errors';
import type { AuthServices } from '../auth/services';
import type { UserRow } from '../auth/store';

/**
 * Admin authorization boundary (D9 sensitive path). Every admin endpoint
 * first authenticates via the shared D14 JWT flow (`requireActiveUser`:
 * 401 when missing/invalid/expired or the account is not active) and then
 * requires `users.is_admin`: a valid non-admin token gets 403
 * `ADMIN_ACCESS_REQUIRED` ("Admin access required"). Admin responses carry
 * only the fields the admin SPA needs (id/email/isAdmin for the header);
 * no other user-private fields leak here.
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
}

export function createAdminRouter(services: AdminRouteServices | AuthServices) {
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
			async ({ headers, jwt: verifier }) => {
				await requireAdmin(
					headers as { authorization?: string },
					verifier as never,
					services.store,
				);
				// Placeholder shell for issue #19 (reports queue + moderation
				// actions). Proves the admin authz gate; carries no user data.
				return { reports: [], total: 0 };
			},
			{
				response: { 200: AdminReports },
			},
		);
}
