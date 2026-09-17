import { ProfileCreate, ProfilePatch, ProfileReplace } from '@together/schemas';
import { Elysia, t } from 'elysia';
import { createAuthGuard } from '../../lib/authentication';
import { HttpError } from '../../lib/errors';
import { buildPhotoKey, type PhotoStorage } from '../../lib/storage';
import type { ProfileServices } from './services';
import type { ProfileRow } from './store';

function forbiddenError(): HttpError {
	return new HttpError(403, 'FORBIDDEN', undefined, undefined, 'Forbidden');
}
function notFoundError(): HttpError {
	return new HttpError(404, 'PROFILE_NOT_FOUND', undefined, undefined, 'Profile not found');
}
function profileExistsError(): HttpError {
	return new HttpError(409, 'PROFILE_EXISTS', undefined, undefined, 'Profile already exists');
}

interface ReputationData {
	contributorSince: Date | null;
	peopleHelped: number;
	successfulContributions: number;
}

function toPublic(row: ProfileRow, reputation: ReputationData, storage: PhotoStorage) {
	const photoKey = row.profilePhotoKey;
	const photoUrl =
		photoKey === null
			? null
			: photoKey.startsWith('http://') || photoKey.startsWith('https://')
				? photoKey
				: storage.publicUrl(photoKey);
	return {
		id: row.id,
		userId: row.userId,
		name: row.displayName,
		photoUrl,
		location: row.location ?? null,
		description: row.bio ?? null,
		areasOfInterest: (row.areasOfInterest as number[] | null) ?? [],
		skills: (row.skills as number[] | null) ?? [],
		resources: (row.resources as string[] | null) ?? [],
		contributionAvailability: (row.contributionAvailability as unknown) ?? null,
		contributorSince: reputation.contributorSince
			? reputation.contributorSince.toISOString()
			: null,
		peopleHelped: reputation.peopleHelped,
		successfulContributions: reputation.successfulContributions,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toPrivate(row: ProfileRow, reputation: ReputationData, storage: PhotoStorage) {
	return {
		...toPublic(row, reputation, storage),
		exactAddress: row.exactAddress ?? null,
	};
}

function mapCreateBody(body: Record<string, unknown>) {
	return {
		displayName: body.name as string,
		bio: (body.description as string | null | undefined) ?? null,
		location: (body.location as string | null | undefined) ?? null,
		photoUrl: (body.photoUrl as string | null | undefined) ?? null,
		areasOfInterest: (body.areasOfInterest as number[] | undefined) ?? [],
		skills: (body.skills as number[] | undefined) ?? [],
		resources: (body.resources as string[] | undefined) ?? [],
		contributionAvailability:
			(body.contributionAvailability as
				| {
						modality: string;
						preferredArea?: string;
						willingToMentor?: boolean;
						willingToLend?: boolean;
						willingToAnswerQuestions?: boolean;
						willingToCollaborate?: boolean;
				  }
				| null
				| undefined) ?? null,
		exactAddress: (body.exactAddress as string | null | undefined) ?? null,
	};
}

function mapReplaceBody(body: Record<string, unknown>) {
	return mapCreateBody(body);
}

function mapPatchBody(body: Record<string, unknown>): Partial<{
	displayName: string;
	bio: string | null;
	location: string | null;
	photoUrl: string | null;
	areasOfInterest: number[];
	skills: number[];
	resources: string[];
	contributionAvailability: {
		modality: string;
		preferredArea?: string;
		willingToMentor?: boolean;
		willingToLend?: boolean;
		willingToAnswerQuestions?: boolean;
		willingToCollaborate?: boolean;
	} | null;
	exactAddress: string | null;
}> {
	const patch: Partial<{
		displayName: string;
		bio: string | null;
		location: string | null;
		photoUrl: string | null;
		areasOfInterest: number[];
		skills: number[];
		resources: string[];
		contributionAvailability: {
			modality: string;
			preferredArea?: string;
			willingToMentor?: boolean;
			willingToLend?: boolean;
			willingToAnswerQuestions?: boolean;
			willingToCollaborate?: boolean;
		} | null;
		exactAddress: string | null;
	}> = {};
	if ('name' in body) patch.displayName = body.name as string;
	if ('description' in body) patch.bio = (body.description as string | null) ?? null;
	if ('location' in body) patch.location = (body.location as string | null) ?? null;
	if ('photoUrl' in body) patch.photoUrl = (body.photoUrl as string | null) ?? null;
	if ('areasOfInterest' in body) patch.areasOfInterest = body.areasOfInterest as number[];
	if ('skills' in body) patch.skills = body.skills as number[];
	if ('resources' in body) patch.resources = body.resources as string[];
	if ('contributionAvailability' in body)
		patch.contributionAvailability = body.contributionAvailability as {
			modality: string;
			preferredArea?: string;
			willingToMentor?: boolean;
			willingToLend?: boolean;
			willingToAnswerQuestions?: boolean;
			willingToCollaborate?: boolean;
		} | null;
	if ('exactAddress' in body) patch.exactAddress = (body.exactAddress as string | null) ?? null;
	return patch;
}

async function fetchReputation(store: ProfileStore, userId: string): Promise<ReputationData> {
	const [since, helped, successful] = await Promise.all([
		store.contributorSince(userId),
		store.peopleHelped(userId),
		store.successfulContributions(userId),
	]);
	return { contributorSince: since, peopleHelped: helped, successfulContributions: successful };
}

export function createProfileRouter(services: ProfileServices) {
	const store = services.store;
	const storage = services.storage;

	const authenticatedProfiles = new Elysia()
		.use(createAuthGuard(services.users, services.jwtSecret))
		.get('/profiles/me', async ({ actor }) => {
			const { userId } = actor;
			const row = await store.findByUserId(userId);
			if (row === undefined) throw notFoundError();
			const reputation = await fetchReputation(store, userId);
			return toPrivate(row, reputation, storage);
		})
		.post(
			'/profiles',
			async ({ body, actor, set }) => {
				const { userId } = actor;
				const existing = await store.findByUserId(userId);
				if (existing !== undefined) throw profileExistsError();
				const input = mapCreateBody(body as Record<string, unknown>);
				try {
					const row = await store.create({ userId, ...input });
					const reputation = await fetchReputation(store, userId);
					set.status = 201;
					return toPrivate(row, reputation, storage);
				} catch (error) {
					const code = (error as { code?: string; constraint_name?: string })?.constraint_name;
					if (code === 'profiles_user_id_unique') throw profileExistsError();
					throw error;
				}
			},
			{ body: ProfileCreate as never },
		)
		.put(
			'/profiles/:id',
			async ({ params, body, actor }) => {
				const { userId } = actor;
				const row = await store.findById(params.id);
				if (row === undefined) throw notFoundError();
				if (row.userId !== userId) throw forbiddenError();
				const input = mapReplaceBody(body as Record<string, unknown>);
				const updated = await store.updateReplace(params.id, input);
				const reputation = await fetchReputation(store, userId);
				return toPrivate(updated, reputation, storage);
			},
			{
				params: t.Object({ id: t.String({ format: 'uuid' }) }),
				body: ProfileReplace as never,
			},
		)
		.patch(
			'/profiles/:id',
			async ({ params, body, actor }) => {
				// Concurrency: last-write-wins (LWW) — no If-Match/versioning this wave; each PATCH overwrites the row and bumps updatedAt.
				const { userId } = actor;
				const row = await store.findById(params.id);
				if (row === undefined) throw notFoundError();
				if (row.userId !== userId) throw forbiddenError();
				const patch = mapPatchBody(body as Record<string, unknown>);
				const updated = await store.updatePatch(params.id, patch);
				const reputation = await fetchReputation(store, userId);
				return toPrivate(updated, reputation, storage);
			},
			{
				params: t.Object({ id: t.String({ format: 'uuid' }) }),
				body: ProfilePatch as never,
			},
		)
		.post(
			'/profiles/:id/photo',
			async ({ params, body, actor }) => {
				const { userId } = actor;
				const row = await store.findById(params.id);
				if (row === undefined) throw notFoundError();
				if (row.userId !== userId) throw forbiddenError();
				const file = (body as { photo?: unknown }).photo as File | undefined;
				if (!(file instanceof File)) {
					throw new HttpError(
						400,
						'VALIDATION',
						{ photo: 'required' },
						undefined,
						'Invalid request',
					);
				}
				if (file.size === 0) {
					throw new HttpError(400, 'VALIDATION', { photo: 'empty' }, undefined, 'Invalid request');
				}
				if (file.size > 5 * 1024 * 1024) {
					throw new HttpError(
						400,
						'VALIDATION',
						{ photo: 'too_large' },
						undefined,
						'Invalid request',
					);
				}
				if (!file.type.startsWith('image/')) {
					throw new HttpError(
						400,
						'VALIDATION',
						{ photo: 'mime_type' },
						undefined,
						'Invalid request',
					);
				}
				const bytes = new Uint8Array(await file.arrayBuffer());
				const key = buildPhotoKey(userId);
				await storage.put(key, bytes, file.type);
				const updated = await store.updatePhotoKey(params.id, key);
				const reputation = await fetchReputation(store, userId);
				return toPrivate(updated, reputation, storage);
			},
			{
				params: t.Object({ id: t.String({ format: 'uuid' }) }),
				body: t.Object({ photo: t.File() }),
			},
		);

	return new Elysia().use(authenticatedProfiles).get(
		'/profiles/:id',
		async ({ params }) => {
			const row = await store.findById(params.id);
			if (row === undefined) throw notFoundError();
			const reputation = await fetchReputation(store, row.userId);
			return toPublic(row, reputation, storage);
		},
		{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
	);
}
