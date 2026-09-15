import type { Sql } from '@together/db';

export interface ProfileRow {
	id: string;
	user_id: string;
	display_name: string;
	bio: string | null;
	location: string | null;
	profile_photo_key: string | null;
	areas_of_interest: number[] | null;
	skills: number[] | null;
	resources: string[] | null;
	contribution_availability: {
		modality: string;
		preferredArea?: string;
		willingToMentor?: boolean;
		willingToLend?: boolean;
		willingToAnswerQuestions?: boolean;
		willingToCollaborate?: boolean;
	} | null;
	exact_address: string | null;
	created_at: Date;
	updated_at: Date;
}

function parseJson<T>(value: unknown): T | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as T;
		} catch {
			return value as unknown as T;
		}
	}
	return value as T;
}

function normalizeRow(row: ProfileRow): ProfileRow {
	return {
		...row,
		areas_of_interest: parseJson<number[]>(row.areas_of_interest) ?? [],
		skills: parseJson<number[]>(row.skills) ?? [],
		resources: parseJson<string[]>(row.resources) ?? [],
		contribution_availability: parseJson<ProfileRow['contribution_availability']>(
			row.contribution_availability,
		),
	};
}

export class ProfileStore {
	constructor(private readonly sql: Sql) {}

	async findById(id: string): Promise<ProfileRow | undefined> {
		const rows = await this.sql<ProfileRow[]>`
			SELECT id, user_id, display_name, bio, location, profile_photo_key,
				areas_of_interest, skills, resources, contribution_availability, exact_address,
				created_at, updated_at
			FROM profiles WHERE id = ${id}`;
		const row = rows[0];
		return row ? normalizeRow(row) : undefined;
	}

	async findByUserId(userId: string): Promise<ProfileRow | undefined> {
		const rows = await this.sql<ProfileRow[]>`
			SELECT id, user_id, display_name, bio, location, profile_photo_key,
				areas_of_interest, skills, resources, contribution_availability, exact_address,
				created_at, updated_at
			FROM profiles WHERE user_id = ${userId}`;
		const row = rows[0];
		return row ? normalizeRow(row) : undefined;
	}

	async contributorSince(userId: string): Promise<Date | null> {
		const rows = await this.sql<{ min: Date | null }[]>`
			SELECT MIN(created_at) as min FROM contributions WHERE contributor_id = ${userId}`;
		return rows[0]?.min ?? null;
	}

	async create(input: {
		userId: string;
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
	}): Promise<ProfileRow> {
		const rows = await this.sql<ProfileRow[]>`
			INSERT INTO profiles (user_id, display_name, bio, location, profile_photo_key, areas_of_interest, skills, resources, contribution_availability, exact_address)
			VALUES (${input.userId}, ${input.displayName}, ${input.bio}, ${input.location}, ${input.photoUrl}, ${JSON.stringify(input.areasOfInterest)}::jsonb, ${JSON.stringify(input.skills)}::jsonb, ${JSON.stringify(input.resources)}::jsonb, ${input.contributionAvailability === null ? null : JSON.stringify(input.contributionAvailability)}::jsonb, ${input.exactAddress})
			RETURNING id, user_id, display_name, bio, location, profile_photo_key,
				areas_of_interest, skills, resources, contribution_availability, exact_address,
				created_at, updated_at`;
		return normalizeRow(rows[0] as ProfileRow);
	}

	async updateReplace(
		id: string,
		input: {
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
		},
	): Promise<ProfileRow> {
		const rows = await this.sql<ProfileRow[]>`
			UPDATE profiles SET display_name = ${input.displayName}, bio = ${input.bio}, location = ${input.location},
				profile_photo_key = ${input.photoUrl},
				areas_of_interest = ${JSON.stringify(input.areasOfInterest)}::jsonb,
				skills = ${JSON.stringify(input.skills)}::jsonb,
				resources = ${JSON.stringify(input.resources)}::jsonb,
				contribution_availability = ${input.contributionAvailability === null ? null : JSON.stringify(input.contributionAvailability)}::jsonb,
				exact_address = ${input.exactAddress},
				updated_at = now()
			WHERE id = ${id}
			RETURNING id, user_id, display_name, bio, location, profile_photo_key,
				areas_of_interest, skills, resources, contribution_availability, exact_address,
				created_at, updated_at`;
		return normalizeRow(rows[0] as ProfileRow);
	}

	async updatePatch(
		id: string,
		patch: Partial<{
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
		}>,
	): Promise<ProfileRow> {
		// Build dynamic SET clause; use sequential updates for LWW simplicity — each PATCH is a single UPDATE.
		const existing = await this.findById(id);
		if (existing === undefined) throw new Error('not found');
		const merged = {
			displayName: patch.displayName ?? existing.display_name,
			bio: patch.bio !== undefined ? patch.bio : existing.bio,
			location: patch.location !== undefined ? patch.location : existing.location,
			photoUrl: patch.photoUrl !== undefined ? patch.photoUrl : existing.profile_photo_key,
			areasOfInterest:
				patch.areasOfInterest ?? (existing.areas_of_interest as number[] | null) ?? [],
			skills: patch.skills ?? (existing.skills as number[] | null) ?? [],
			resources: patch.resources ?? (existing.resources as string[] | null) ?? [],
			contributionAvailability:
				patch.contributionAvailability !== undefined
					? patch.contributionAvailability
					: (existing.contribution_availability as {
							modality: string;
							preferredArea?: string;
							willingToMentor?: boolean;
							willingToLend?: boolean;
							willingToAnswerQuestions?: boolean;
							willingToCollaborate?: boolean;
						} | null),
			exactAddress: patch.exactAddress !== undefined ? patch.exactAddress : existing.exact_address,
		};
		return this.updateReplace(id, {
			displayName: merged.displayName,
			bio: merged.bio,
			location: merged.location,
			photoUrl: merged.photoUrl,
			areasOfInterest: merged.areasOfInterest,
			skills: merged.skills,
			resources: merged.resources,
			contributionAvailability: merged.contributionAvailability,
			exactAddress: merged.exactAddress,
		});
	}

	async updatePhotoKey(id: string, key: string): Promise<ProfileRow> {
		const rows = await this.sql<ProfileRow[]>`
			UPDATE profiles SET profile_photo_key = ${key}, updated_at = now() WHERE id = ${id}
			RETURNING id, user_id, display_name, bio, location, profile_photo_key,
				areas_of_interest, skills, resources, contribution_availability, exact_address,
				created_at, updated_at`;
		return normalizeRow(rows[0] as ProfileRow);
	}
}
