import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { createAuthGuard } from '../../lib/authentication';
import type { RequestRouteAuth } from './routes';
import type { RequestService } from './services';

export function createVoteRouter(requestService: RequestService, auth: RequestRouteAuth) {
	return new Elysia().use(jwt({ name: 'jwt', secret: auth.jwtSecret, exp: '15m' })).use(
		new Elysia()
			.use(createAuthGuard({ findUserById: auth.findUserById }, auth.jwtSecret))
			.post(
				'/requests/:id/vote',
				async ({ params, actor, set }) => {
					const result = await requestService.vote(params.id, actor.userId);
					set.status = 201;
					return result;
				},
				{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
			)
			.delete(
				'/requests/:id/vote',
				async ({ params, actor, set }) => {
					const result = await requestService.removeVote(params.id, actor.userId);
					set.status = 200;
					return result;
				},
				{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
			),
	);
}
