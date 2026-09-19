import { jwt } from '@elysiajs/jwt';
import { RequestDraftCreate, RequestPatch } from '@together/schemas';
import { Elysia, t } from 'elysia';
import {
	createAuthGuard,
	type JwtVerifier,
	requireActiveActor,
	requireUnsuspendedUser,
} from '../../lib/authentication';
import type { RequestService } from './services';

export interface RequestRouteAuth {
	findUserById: (id: string) => Promise<{ status: string; deletedAt: Date | null } | undefined>;
	jwtSecret: string;
}

export function createRequestRouter(requestService: RequestService, auth: RequestRouteAuth) {
	return new Elysia()
		.use(jwt({ name: 'jwt', secret: auth.jwtSecret, exp: '15m' }))
		.get(
			'/requests/:id',
			async ({ params, headers, jwt: verifier }) => {
				let actorUserId: string | undefined;
				const authHeader = (headers as { authorization?: string }).authorization;
				if (authHeader?.startsWith('Bearer ')) {
					try {
						const actor = await requireActiveActor(
							headers as { authorization?: string },
							verifier as unknown as JwtVerifier,
							{ findUserById: auth.findUserById },
						);
						actorUserId = actor.userId;
					} catch {
						actorUserId = undefined;
					}
				}

				return requestService.getRequest(params.id, actorUserId);
			},
			{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
		)
		.post(
			'/requests',
			async ({ body, headers, jwt: verifier, set }) => {
				// Suspended accounts are rejected here with 403
				// ACCOUNT_SUSPENDED (issue #19) rather than the guard's
				// generic 401, so the client can tell a suspended account
				// apart from a logged-out one.
				const { actor } = await requireUnsuspendedUser(
					headers as { authorization?: string },
					verifier as unknown as JwtVerifier,
					{ findUserById: auth.findUserById },
				);
				const result = await requestService.createDraft(actor.userId, body);
				set.status = 201;
				return result;
			},
			{ body: RequestDraftCreate },
		)
		.post(
			'/requests/drafts',
			async ({ body, headers, jwt: verifier, set }) => {
				// Same suspended-account handling as POST /requests above.
				const { actor } = await requireUnsuspendedUser(
					headers as { authorization?: string },
					verifier as unknown as JwtVerifier,
					{ findUserById: auth.findUserById },
				);
				const result = await requestService.createDraft(actor.userId, body);
				set.status = 201;
				return result;
			},
			{ body: RequestDraftCreate },
		)
		.use(
			new Elysia()
				.use(createAuthGuard({ findUserById: auth.findUserById }, auth.jwtSecret))
				.patch(
					'/requests/:id',
					async ({ params, body, actor }) => {
						return requestService.patchRequest(params.id, actor.userId, body);
					},
					{
						params: t.Object({ id: t.String({ format: 'uuid' }) }),
						body: RequestPatch,
					},
				)
				.get(
					'/requests/:id/preview',
					async ({ params, actor }) => {
						return requestService.previewRequest(params.id, actor.userId);
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				)
				.post(
					'/requests/:id/publish',
					async ({ params, actor }) => {
						return requestService.publishRequest(params.id, actor.userId);
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				)
				.post(
					'/requests/:id/close',
					async ({ params, body, actor }) => {
						return requestService.closeRequest(params.id, actor.userId, body);
					},
					{
						params: t.Object({ id: t.String({ format: 'uuid' }) }),
						body: t.Optional(t.Object({ reason: t.Optional(t.String()) })),
					},
				)
				.post(
					'/requests/:id/cancel',
					async ({ params, actor }) => {
						return requestService.cancelRequest(params.id, actor.userId);
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				)
				.post(
					'/requests/:id/archive',
					async ({ params, actor }) => {
						return requestService.archiveRequest(params.id, actor.userId);
					},
					{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
				),
		);
}
