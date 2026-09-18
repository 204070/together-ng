import { jwt } from '@elysiajs/jwt';
import { RequestDraftCreate, RequestPatch } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { createAuthGuard, type JwtVerifier, requireActiveActor } from '../../lib/authentication';
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
		.use(
			new Elysia()
				.use(createAuthGuard({ findUserById: auth.findUserById }, auth.jwtSecret))
				.post(
					'/requests',
					async ({ body, actor, set }) => {
						const result = await requestService.createDraft(actor.userId, body);
						set.status = 201;
						return result;
					},
					{ body: RequestDraftCreate },
				)
				.post(
					'/requests/drafts',
					async ({ body, actor, set }) => {
						const result = await requestService.createDraft(actor.userId, body);
						set.status = 201;
						return result;
					},
					{ body: RequestDraftCreate },
				)
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
