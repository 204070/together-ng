import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';
import { unauthorizedError } from './errors';

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
	const token = extractBearer(headers.authorization);
	if (token === undefined) throw unauthorizedError();

	const payload = await jwt.verify(token);
	if (!payload || typeof payload !== 'object') throw unauthorizedError();
	const { sub, sid } = payload as { sub?: unknown; sid?: unknown };
	if (typeof sub !== 'string' || typeof sid !== 'string') throw unauthorizedError();

	const user = await users.findUserById(sub);
	if (user?.status !== 'active' || user.deletedAt !== null) throw unauthorizedError();
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
