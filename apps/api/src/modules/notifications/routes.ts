import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { type JwtVerifier, requireActiveActor } from '../../lib/authentication';
import type { NotificationService } from './services';
import { toNotificationResponse } from './store';

export interface NotificationRouterOptions {
	jwtSecret: string;
	findUserById: (id: string) => Promise<{ status: string; deletedAt: Date | null } | undefined>;
}

export function createNotificationRouter(
	service: NotificationService,
	options: NotificationRouterOptions,
) {
	return new Elysia()
		.use(jwt({ name: 'jwt', secret: options.jwtSecret, exp: '15m' }))
		.derive(async ({ headers, jwt: verifier }) => {
			const authHeader = (headers as { authorization?: string }).authorization;
			if (!authHeader) return { actor: null as { userId: string } | null };
			try {
				const actor = await requireActiveActor(
					headers as { authorization?: string },
					verifier as unknown as JwtVerifier,
					options,
				);
				return { actor };
			} catch {
				return { actor: null as { userId: string } | null };
			}
		})
		.get(
			'/notifications',
			async ({ actor, set }) => {
				if (!actor) {
					set.status = 401;
					return { error: 'UNAUTHORIZED', message: 'Authentication required' };
				}
				return service.listForUser(actor.userId);
			},
			{},
		)
		.patch(
			'/notifications/:id',
			async ({ params, body, actor, set }) => {
				if (!actor) {
					set.status = 401;
					return { error: 'UNAUTHORIZED', message: 'Authentication required' };
				}
				const existing = await service.getByIdAndUser(params.id, actor.userId);
				if (!existing) {
					set.status = 404;
					return { error: 'NOT_FOUND', message: 'Notification not found' };
				}
				const b = body as { read?: boolean };
				let updated = existing;
				if (b.read === true) {
					updated = (await service.markRead(params.id, actor.userId)) ?? existing;
				} else if (b.read === false) {
					updated = (await service.markUnread(params.id, actor.userId)) ?? existing;
				}
				return toNotificationResponse(updated);
			},
			{
				params: t.Object({ id: t.String({ format: 'uuid' }) }),
				body: t.Object({ read: t.Boolean() }),
			},
		)
		.post(
			'/notifications/read-all',
			async ({ actor, set }) => {
				if (!actor) {
					set.status = 401;
					return { error: 'UNAUTHORIZED', message: 'Authentication required' };
				}
				await service.markAllRead(actor.userId);
				set.status = 204;
				return undefined;
			},
			{},
		);
}
