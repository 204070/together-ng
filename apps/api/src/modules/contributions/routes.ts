import { jwt } from '@elysiajs/jwt';
import { ContributionComplete, ContributionConfirm, OutcomeSubmit } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { createAuthGuard, type JwtVerifier, requireActiveActor } from '../../lib/authentication';
import type { ContributionService } from './services';

export interface ContributionRouteAuth {
	findUserById: (id: string) => Promise<{ status: string; deletedAt: Date | null } | undefined>;
	jwtSecret: string;
}

export function createContributionRouter(
	contributionService: ContributionService,
	auth: ContributionRouteAuth,
) {
	return new Elysia()
		.use(jwt({ name: 'jwt', secret: auth.jwtSecret, exp: '15m' }))
		.get(
			'/contributions/:id',
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

				return contributionService.getContribution(params.id, actorUserId);
			},
			{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
		)
		.use(
			new Elysia()
				.use(createAuthGuard({ findUserById: auth.findUserById }, auth.jwtSecret))
				.post(
					'/contributions/:id/complete',
					async ({ params, body, actor, set }) => {
						const updated = await contributionService.completeContribution(
							params.id,
							actor.userId,
							body,
						);
						set.status = 200;
						return updated;
					},
					{
						params: t.Object({ id: t.String({ format: 'uuid' }) }),
						body: ContributionComplete,
					},
				)
				.post(
					'/contributions/:id/confirm',
					async ({ params, body, actor, set }) => {
						const confirmation = await contributionService.confirmContribution(
							params.id,
							actor.userId,
							body,
						);
						set.status = 201;
						return confirmation;
					},
					{
						params: t.Object({ id: t.String({ format: 'uuid' }) }),
						body: ContributionConfirm,
					},
				)
				.post(
					'/contributions/:id/outcome',
					async ({ params, body, actor, set }) => {
						const outcome = await contributionService.submitOutcome(params.id, actor.userId, body);
						set.status = 201;
						return outcome;
					},
					{
						params: t.Object({ id: t.String({ format: 'uuid' }) }),
						body: OutcomeSubmit,
					},
				),
		);
}
