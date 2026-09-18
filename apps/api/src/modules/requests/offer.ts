import { jwt } from '@elysiajs/jwt';
import { OfferAction, OfferCreate } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { createAuthGuard, type JwtVerifier, requireActiveActor } from '../../lib/authentication';
import type { RequestRouteAuth } from './routes';
import type { RequestService } from './services';

export function createOfferRouter(requestService: RequestService, auth: RequestRouteAuth) {
	return new Elysia()
		.use(jwt({ name: 'jwt', secret: auth.jwtSecret, exp: '15m' }))
		.get(
			'/requests/:id/offers',
			async ({ params, headers, jwt: verifier, set }) => {
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

				const result = await requestService.getOffers(params.id, actorUserId);
				set.status = 200;
				return result;
			},
			{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
		)
		.use(
			new Elysia()
				.use(createAuthGuard({ findUserById: auth.findUserById }, auth.jwtSecret))
				.post(
					'/requests/:id/offers',
					async ({ params, body, actor, set }) => {
						const offer = await requestService.createOffer(params.id, actor.userId, body);
						set.status = 201;
						return offer;
					},
					{
						params: t.Object({ id: t.String({ format: 'uuid' }) }),
						body: OfferCreate,
					},
				)
				.post(
					'/requests/:id/offers/:offerId/accept',
					async ({ params, body, actor, set }) => {
						const accepted = await requestService.acceptOffer(
							params.id,
							params.offerId,
							actor.userId,
							body,
						);
						set.status = 200;
						return accepted;
					},
					{
						params: t.Object({
							id: t.String({ format: 'uuid' }),
							offerId: t.String({ format: 'uuid' }),
						}),
						body: t.Optional(OfferAction),
					},
				)
				.post(
					'/requests/:id/offers/:offerId/decline',
					async ({ params, body, actor, set }) => {
						const declined = await requestService.declineOffer(
							params.id,
							params.offerId,
							actor.userId,
							body,
						);
						set.status = 200;
						return declined;
					},
					{
						params: t.Object({
							id: t.String({ format: 'uuid' }),
							offerId: t.String({ format: 'uuid' }),
						}),
						body: t.Optional(OfferAction),
					},
				),
		);
}
