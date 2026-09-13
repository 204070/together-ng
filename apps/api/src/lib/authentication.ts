import { unauthorizedError } from './errors';

export interface AuthenticatedActor {
	userId: string;
	sessionId: string;
}

export interface JwtVerifier {
	verify(token: string): Promise<unknown>;
}

export interface ActiveUserLookup {
	findUserById(id: string): Promise<{ status: string; deleted_at: Date | null } | undefined>;
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
	const token = extractBearer(headers.authorization);
	if (token === undefined) throw unauthorizedError();

	const payload = await jwt.verify(token);
	if (!payload || typeof payload !== 'object') throw unauthorizedError();
	const { sub, sid } = payload as { sub?: unknown; sid?: unknown };
	if (typeof sub !== 'string' || typeof sid !== 'string') throw unauthorizedError();

	const user = await users.findUserById(sub);
	if (user?.status !== 'active' || user.deleted_at !== null) throw unauthorizedError();
	return { userId: sub, sessionId: sid };
}
