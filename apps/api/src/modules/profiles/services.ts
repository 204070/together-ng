import { buildPhotoKey, type FileStorage } from '../../infra/storage';
import { HttpError } from '../../lib/errors';
import type { ProfileRow, ProfileStore } from './store';

function forbiddenError(): HttpError {
	return new HttpError(403, 'FORBIDDEN', undefined, undefined, 'Forbidden');
}

function notFoundError(): HttpError {
	return new HttpError(404, 'PROFILE_NOT_FOUND', undefined, undefined, 'Profile not found');
}

function profileExistsError(): HttpError {
	return new HttpError(409, 'PROFILE_EXISTS', undefined, undefined, 'Profile already exists');
}

export interface ReputationData {
	contributorSince: Date | null;
	peopleHelped: number;
	successfulContributions: number;
}

export function toPublic(row: ProfileRow, reputation: ReputationData, storage: FileStorage) {
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

export function toPrivate(row: ProfileRow, reputation: ReputationData, storage: FileStorage) {
	return {
		...toPublic(row, reputation, storage),
		exactAddress: row.exactAddress ?? null,
	};
}

export function mapCreateBody(body: Record<string, unknown>) {
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

export function mapReplaceBody(body: Record<string, unknown>) {
	return mapCreateBody(body);
}

export function mapPatchBody(body: Record<string, unknown>): Partial<{
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

export class ProfileService {
	constructor(
		public readonly store: ProfileStore,
		public readonly storage: FileStorage,
	) {}

	async fetchReputation(userId: string): Promise<ReputationData> {
		const [since, helped, successful] = await Promise.all([
			this.store.contributorSince(userId),
			this.store.peopleHelped(userId),
			this.store.successfulContributions(userId),
		]);
		return { contributorSince: since, peopleHelped: helped, successfulContributions: successful };
	}

	async getPublicProfile(id: string) {
		const row = await this.store.findById(id);
		if (row === undefined) throw notFoundError();
		const reputation = await this.fetchReputation(row.userId);
		return toPublic(row, reputation, this.storage);
	}

	async getMyProfile(userId: string) {
		const row = await this.store.findByUserId(userId);
		if (row === undefined) throw notFoundError();
		const reputation = await this.fetchReputation(userId);
		return toPrivate(row, reputation, this.storage);
	}

	async createProfile(userId: string, body: Record<string, unknown>) {
		const existing = await this.store.findByUserId(userId);
		if (existing !== undefined) throw profileExistsError();
		const input = mapCreateBody(body);
		try {
			const row = await this.store.create({ userId, ...input });
			const reputation = await this.fetchReputation(userId);
			return toPrivate(row, reputation, this.storage);
		} catch (error) {
			const code = (error as { code?: string; constraint_name?: string })?.constraint_name;
			if (code === 'profiles_user_id_unique') throw profileExistsError();
			throw error;
		}
	}

	async replaceProfile(id: string, userId: string, body: Record<string, unknown>) {
		const row = await this.store.findById(id);
		if (row === undefined) throw notFoundError();
		if (row.userId !== userId) throw forbiddenError();
		const input = mapReplaceBody(body);
		const updated = await this.store.updateReplace(id, input);
		const reputation = await this.fetchReputation(userId);
		return toPrivate(updated, reputation, this.storage);
	}

	async patchProfile(id: string, userId: string, body: Record<string, unknown>) {
		const row = await this.store.findById(id);
		if (row === undefined) throw notFoundError();
		if (row.userId !== userId) throw forbiddenError();
		const patch = mapPatchBody(body);
		const updated = await this.store.updatePatch(id, patch);
		const reputation = await this.fetchReputation(userId);
		return toPrivate(updated, reputation, this.storage);
	}

	async uploadPhoto(id: string, userId: string, file: unknown) {
		const row = await this.store.findById(id);
		if (row === undefined) throw notFoundError();
		if (row.userId !== userId) throw forbiddenError();

		if (!(file instanceof File)) {
			throw new HttpError(400, 'VALIDATION', { photo: 'required' }, undefined, 'Invalid request');
		}
		if (file.size === 0) {
			throw new HttpError(400, 'VALIDATION', { photo: 'empty' }, undefined, 'Invalid request');
		}
		if (file.size > 5 * 1024 * 1024) {
			throw new HttpError(400, 'VALIDATION', { photo: 'too_large' }, undefined, 'Invalid request');
		}
		if (!file.type.startsWith('image/')) {
			throw new HttpError(400, 'VALIDATION', { photo: 'mime_type' }, undefined, 'Invalid request');
		}
		const bytes = new Uint8Array(await file.arrayBuffer());
		const key = buildPhotoKey(userId);
		await this.storage.put(key, bytes, file.type);
		const updated = await this.store.updatePhotoKey(id, key);
		const reputation = await this.fetchReputation(userId);
		return toPrivate(updated, reputation, this.storage);
	}
}

export function createProfileService(store: ProfileStore, storage: FileStorage): ProfileService {
	return new ProfileService(store, storage);
}

export const createProfileServices = createProfileService;
export type ProfileServices = ProfileService;
