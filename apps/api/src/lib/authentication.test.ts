import { describe, expect, test } from 'bun:test';
import { extractBearer, requireActiveActor } from './authentication';
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
			{ findUserById: async () => ({ status: 'active', deleted_at: null }) },
		);
		expect(actor).toEqual({ userId: 'user-1', sessionId: 'session-1' });
	});

	test('rejects a token for an inactive account', async () => {
		try {
			await requireActiveActor(
				{ authorization: 'Bearer token' },
				{ verify: async () => ({ sub: 'user-1', sid: 'session-1' }) },
				{ findUserById: async () => ({ status: 'suspended', deleted_at: null }) },
			);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(HttpError);
			expect((error as HttpError).code).toBe('UNAUTHORIZED');
		}
	});
});
