import { contributions, type Db, eq, type Profile, profiles, sql } from '@together/db';

export class ProfileStore {
	constructor(private readonly db: Db) {}

	async findById(id: string): Promise<Profile | undefined> {
		const rows = await this.db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
		return rows[0];
	}

	async findByUserId(userId: string): Promise<Profile | undefined> {
		const rows = await this.db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
		return rows[0];
	}

	async contributorSince(userId: string): Promise<Date | null> {
		const rows = await this.db
			.select({ min: sql<Date | null>`MIN(${contributions.createdAt})` })
			.from(contributions)
			.where(eq(contributions.contributorId, userId));
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
	}): Promise<Profile> {
		const rows = await this.db
			.insert(profiles)
			.values({
				userId: input.userId,
				displayName: input.displayName,
				bio: input.bio,
				location: input.location,
				profilePhotoKey: input.photoUrl,
				areasOfInterest: input.areasOfInterest,
				skills: input.skills,
				resources: input.resources,
				contributionAvailability: input.contributionAvailability as any,
				exactAddress: input.exactAddress,
			})
			.returning();
		return rows[0]!;
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
	): Promise<Profile> {
		const rows = await this.db
			.update(profiles)
			.set({
				displayName: input.displayName,
				bio: input.bio,
				location: input.location,
				profilePhotoKey: input.photoUrl,
				areasOfInterest: input.areasOfInterest,
				skills: input.skills,
				resources: input.resources,
				contributionAvailability: input.contributionAvailability as any,
				exactAddress: input.exactAddress,
				updatedAt: new Date(),
			})
			.where(eq(profiles.id, id))
			.returning();
		return rows[0]!;
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
	): Promise<Profile> {
		const existing = await this.findById(id);
		if (existing === undefined) throw new Error('not found');
		const merged = {
			displayName: patch.displayName ?? existing.displayName,
			bio: patch.bio !== undefined ? patch.bio : existing.bio,
			location: patch.location !== undefined ? patch.location : existing.location,
			photoUrl: patch.photoUrl !== undefined ? patch.photoUrl : existing.profilePhotoKey,
			areasOfInterest: patch.areasOfInterest ?? (existing.areasOfInterest as number[] | null) ?? [],
			skills: patch.skills ?? (existing.skills as number[] | null) ?? [],
			resources: patch.resources ?? (existing.resources as string[] | null) ?? [],
			contributionAvailability:
				patch.contributionAvailability !== undefined
					? patch.contributionAvailability
					: (existing.contributionAvailability as {
							modality: string;
							preferredArea?: string;
							willingToMentor?: boolean;
							willingToLend?: boolean;
							willingToAnswerQuestions?: boolean;
							willingToCollaborate?: boolean;
						} | null),
			exactAddress: patch.exactAddress !== undefined ? patch.exactAddress : existing.exactAddress,
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

	async updatePhotoKey(id: string, key: string): Promise<Profile> {
		const rows = await this.db
			.update(profiles)
			.set({ profilePhotoKey: key, updatedAt: new Date() })
			.where(eq(profiles.id, id))
			.returning();
		return rows[0]!;
	}
}

export type ProfileRow = Profile;
