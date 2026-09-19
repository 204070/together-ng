import { describe, expect, test } from 'bun:test';
import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';
import {
	createAuthGuard,
	extractBearer,
	requireActiveActor,
	requireActiveUser,
	requireUnsuspendedUser,
} from './authentication';
import { HttpError } from './errors';

describe('authentication boundary', () => {
	test('extracts a bearer token without accepting another scheme', () => {
		expect(extractBearer('Bearer token')).toBe('token');
		expect(extractBearer('basic token')).toBeUndefined();
	});

	test('returns an active actor with a session id', async () => {
		const actor = await requireActiveActor(
			{ authorization: 'Bearer token' },
			{ verify: async () => ({ sub: 'user-1', sid: 'session-1' }) },
			{ findUserById: async () => ({ status: 'active', deletedAt: null }) },
		);
		expect(actor).toEqual({ userId: 'user-1', sessionId: 'session-1' });
	});

	test('rejects a token for an inactive account', async () => {
		try {
			await requireActiveActor(
				{ authorization: 'Bearer token' },
				{ verify: async () => ({ sub: 'user-1', sid: 'session-1' }) },
				{ findUserById: async () => ({ status: 'suspended', deletedAt: null }) },
			);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(HttpError);
			expect((error as HttpError).code).toBe('UNAUTHORIZED');
		}
	});

	test('returns both actor and user entity via requireActiveUser', async () => {
		const userEntity = {
			id: 'user-1',
			status: 'active',
			deletedAt: null,
			email: 'test@example.com',
		};
		const result = await requireActiveUser(
			{ authorization: 'Bearer token' },
			{ verify: async () => ({ sub: 'user-1', sid: 'session-1' }) },
			{ findUserById: async () => userEntity },
		);
		expect(result.actor).toEqual({ userId: 'user-1', sessionId: 'session-1' });
		expect(result.user).toEqual(userEntity);
	});

	test('requireUnsuspendedUser maps suspended to 403 ACCOUNT_SUSPENDED', async () => {
		try {
			await requireUnsuspendedUser(
				{ authorization: 'Bearer token' },
				{ verify: async () => ({ sub: 'user-1', sid: 'session-1' }) },
				{ findUserById: async () => ({ status: 'suspended', deletedAt: null }) },
			);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(HttpError);
			expect((error as HttpError).status).toBe(403);
			expect((error as HttpError).code).toBe('ACCOUNT_SUSPENDED');
		}
	});

	test('requireUnsuspendedUser keeps 401 for banned accounts', async () => {
		try {
			await requireUnsuspendedUser(
				{ authorization: 'Bearer token' },
				{ verify: async () => ({ sub: 'user-1', sid: 'session-1' }) },
				{ findUserById: async () => ({ status: 'banned', deletedAt: null }) },
			);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(HttpError);
			expect((error as HttpError).status).toBe(401);
			expect((error as HttpError).code).toBe('UNAUTHORIZED');
		}
	});

	test('createAuthGuard authenticates requests through scoped derive', async () => {
		const secret = 'test-secret-123456';
		let generatedToken = '';

		const signerApp = new Elysia()
			.use(jwt({ name: 'jwtSign', secret, exp: '15m' }))
			.get('/token', async ({ jwtSign }) => {
				return jwtSign.sign({ sub: 'user-guard', sid: 'session-guard' });
			});

		const tokenResponse = await signerApp.handle(new Request('http://localhost/token'));
		generatedToken = await tokenResponse.text();

		const protectedApp = new Elysia()
			.use(
				createAuthGuard(
					{
						findUserById: async (id) =>
							id === 'user-guard' ? { status: 'active', deletedAt: null } : undefined,
					},
					secret,
				),
			)
			.get('/secret', ({ actor }) => ({ userId: actor.userId, sessionId: actor.sessionId }));

		const res = await protectedApp.handle(
			new Request('http://localhost/secret', {
				headers: { authorization: `Bearer ${generatedToken}` },
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { userId: string; sessionId: string };
		expect(body).toEqual({ userId: 'user-guard', sessionId: 'session-guard' });
	});
});
