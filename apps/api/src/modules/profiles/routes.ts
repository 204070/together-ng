import { ProfileCreate, ProfilePatch, ProfileReplace } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { createAuthGuard } from '../../lib/authentication';
import type { ProfileService } from './services';

export interface ProfileRouteAuth {
	findUserById: (id: string) => Promise<{ status: string; deletedAt: Date | null } | undefined>;
	jwtSecret: string;
}

export function createProfileRouter(profileService: ProfileService, auth: ProfileRouteAuth) {
	const authenticatedProfiles = new Elysia()
		.use(createAuthGuard({ findUserById: auth.findUserById }, auth.jwtSecret))
		.get('/profiles/me', async ({ actor }) => {
			return profileService.getMyProfile(actor.userId);
		})
		.post(
			'/profiles',
			async ({ body, actor, set }) => {
				const result = await profileService.createProfile(
					actor.userId,
					body as Record<string, unknown>,
				);
				set.status = 201;
				return result;
			},
			{ body: ProfileCreate },
		)
		.put(
			'/profiles/:id',
			async ({ params, body, actor }) => {
				return profileService.replaceProfile(
					params.id,
					actor.userId,
					body as Record<string, unknown>,
				);
			},
			{
				params: t.Object({ id: t.String({ format: 'uuid' }) }),
				body: ProfileReplace,
			},
		)
		.patch(
			'/profiles/:id',
			async ({ params, body, actor }) => {
				return profileService.patchProfile(
					params.id,
					actor.userId,
					body as Record<string, unknown>,
				);
			},
			{
				params: t.Object({ id: t.String({ format: 'uuid' }) }),
				body: ProfilePatch,
			},
		)
		.post(
			'/profiles/:id/photo',
			async ({ params, body, actor }) => {
				const file = (body as { photo?: unknown }).photo;
				return profileService.uploadPhoto(params.id, actor.userId, file);
			},
			{
				params: t.Object({ id: t.String({ format: 'uuid' }) }),
				body: t.Object({ photo: t.File() }),
			},
		);

	return new Elysia().use(authenticatedProfiles).get(
		'/profiles/:id',
		async ({ params }) => {
			return profileService.getPublicProfile(params.id);
		},
		{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
	);
}
