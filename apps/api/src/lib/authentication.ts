import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';
import { forbiddenError, unauthorizedError } from './errors';

export interface AuthenticatedActor {
	userId: string;
	sessionId: string;
}

export interface JwtVerifier {
	verify(token: string): Promise<unknown>;
}

export interface ActiveUser {
	status: string;
	deletedAt: Date | null;
}

export interface ActiveUserLookup<TUser extends ActiveUser = ActiveUser> {
	findUserById(id: string): Promise<TUser | undefined>;
}

export function extractBearer(authorization: string | undefined): string | undefined {
	if (authorization === undefined) return undefined;
	return /^Bearer\s+(.+)$/i.exec(authorization.trim())?.[1];
}

/**
 * The common authentication boundary for protected HTTP routes.  It keeps
 * JWT parsing and account-status checks consistent while leaving resource
 * authorization to domain policies.
 */
export async function requireActiveActor(
	headers: { authorization?: string },
	jwt: JwtVerifier,
	users: ActiveUserLookup,
): Promise<AuthenticatedActor> {
	const { actor } = await requireActiveUser(headers, jwt, users);
	return actor;
}

/**
 * Authenticates an actor and returns the already-loaded account for handlers
 * that need it. This avoids a second account lookup in endpoints such as
 * /auth/me without expanding the minimal actor passed to ordinary routes.
 */
export async function requireActiveUser<TUser extends ActiveUser>(
	headers: { authorization?: string },
	jwt: JwtVerifier,
	users: ActiveUserLookup<TUser>,
): Promise<{ actor: AuthenticatedActor; user: TUser }> {
	const { actor, user } = await verifyActor(headers, jwt, users);
	if (user.status !== 'active' || user.deletedAt !== null) throw unauthorizedError();
	return { actor, user };
}

/**
 * Authenticates an actor like `requireActiveUser`, except a suspended
 * account is rejected with 403 `ACCOUNT_SUSPENDED` instead of 401 so the
 * client can tell "logged in but suspended" apart from "not logged in".
 * Every other non-active account (banned, deactivated, deleted) still gets
 * 401, exactly as before. Used by endpoints where issue #19 requires the
 * suspended status to be visible (`GET /auth/me`, `POST /requests`).
 */
export async function requireUnsuspendedUser<TUser extends ActiveUser>(
	headers: { authorization?: string },
	jwt: JwtVerifier,
	users: ActiveUserLookup<TUser>,
): Promise<{ actor: AuthenticatedActor; user: TUser }> {
	const { actor, user } = await verifyActor(headers, jwt, users);
	if (user.status === 'suspended' && user.deletedAt === null) {
		throw forbiddenError('ACCOUNT_SUSPENDED', 'Account suspended');
	}
	if (user.status !== 'active' || user.deletedAt !== null) throw unauthorizedError();
	return { actor, user };
}

async function verifyActor<TUser extends ActiveUser>(
	headers: { authorization?: string },
	jwt: JwtVerifier,
	users: ActiveUserLookup<TUser>,
): Promise<{ actor: AuthenticatedActor; user: TUser }> {
	const token = extractBearer(headers.authorization);
	if (token === undefined) throw unauthorizedError();

	const payload = await jwt.verify(token);
	if (!payload || typeof payload !== 'object') throw unauthorizedError();
	const { sub, sid } = payload as { sub?: unknown; sid?: unknown };
	if (typeof sub !== 'string' || typeof sid !== 'string') throw unauthorizedError();

	const user = await users.findUserById(sub);
	if (user === undefined) throw unauthorizedError();
	return { actor: { userId: sub, sessionId: sid }, user };
}

/**
 * Scoped Elysia guard for route groups that require an active account. It
 * exposes a minimal actor; domain policies remain responsible for ownership
 * and role decisions.
 */
export function createAuthGuard(users: ActiveUserLookup, jwtSecret: string) {
	return new Elysia({ name: 'auth.guard' })
		.use(jwt({ name: 'jwt', secret: jwtSecret, exp: '15m' }))
		.derive(async ({ headers, jwt: verifier }) => ({
			actor: await requireActiveActor(
				headers as { authorization?: string },
				verifier as unknown as JwtVerifier,
				users,
			),
		}))
		.as('scoped');
}
