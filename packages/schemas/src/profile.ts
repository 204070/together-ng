import { type Static, Type } from '@sinclair/typebox';
import './formats';

export const ContributionAvailability = Type.Object(
	{
		modality: Type.Union([Type.Literal('online'), Type.Literal('in_person'), Type.Literal('both')]),
		preferredArea: Type.Optional(Type.String({ maxLength: 200 })),
		willingToMentor: Type.Optional(Type.Boolean()),
		willingToLend: Type.Optional(Type.Boolean()),
		willingToAnswerQuestions: Type.Optional(Type.Boolean()),
		willingToCollaborate: Type.Optional(Type.Boolean()),
	},
	{ additionalProperties: false },
);

const NameField = Type.String({ minLength: 1, maxLength: 100, pattern: '.*\\S.*' });
const LocationField = Type.Union([Type.String({ maxLength: 200 }), Type.Null()]);
const DescriptionField = Type.Union([Type.String({ maxLength: 1000 }), Type.Null()]);
const AreasField = Type.Array(Type.Integer(), { maxItems: 50 });
const SkillsField = Type.Array(Type.Integer(), { maxItems: 50 });
const ResourcesField = Type.Array(Type.String({ minLength: 1, maxLength: 500 }), { maxItems: 50 });
const ExactAddressField = Type.Union([Type.String({ maxLength: 500 }), Type.Null()]);
const PhotoUrlField = Type.Union([Type.String(), Type.Null()]);

const baseInputFields = {
	name: NameField,
	location: Type.Optional(LocationField),
	description: Type.Optional(DescriptionField),
	photoUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
	areasOfInterest: Type.Optional(AreasField),
	skills: Type.Optional(SkillsField),
	resources: Type.Optional(ResourcesField),
	contributionAvailability: Type.Optional(Type.Union([ContributionAvailability, Type.Null()])),
	exactAddress: Type.Optional(ExactAddressField),
};

export const ProfileCreate = Type.Object(baseInputFields, { additionalProperties: false });

export const ProfileReplace = Type.Object(baseInputFields, { additionalProperties: false });

export const ProfilePatch = Type.Object(
	{
		name: Type.Optional(NameField),
		location: Type.Optional(LocationField),
		description: Type.Optional(DescriptionField),
		photoUrl: Type.Optional(Type.Union([Type.String(), Type.Null()])),
		areasOfInterest: Type.Optional(AreasField),
		skills: Type.Optional(SkillsField),
		resources: Type.Optional(ResourcesField),
		contributionAvailability: Type.Optional(Type.Union([ContributionAvailability, Type.Null()])),
		exactAddress: Type.Optional(ExactAddressField),
	},
	{ additionalProperties: false },
);

const ProfilePublicFields = {
	id: Type.String({ format: 'uuid' }),
	userId: Type.String({ format: 'uuid' }),
	name: Type.String({ minLength: 1, maxLength: 100 }),
	photoUrl: PhotoUrlField,
	location: LocationField,
	description: DescriptionField,
	areasOfInterest: AreasField,
	skills: SkillsField,
	resources: ResourcesField,
	contributionAvailability: Type.Union([ContributionAvailability, Type.Null()]),
	contributorSince: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
};

export const ProfilePublic = Type.Object(ProfilePublicFields, { additionalProperties: false });

export const ProfilePrivate = Type.Composite(
	[
		ProfilePublic,
		Type.Object({ exactAddress: ExactAddressField }, { additionalProperties: false }),
	],
	{ additionalProperties: false },
);

// Legacy #3-era shape — kept for existing tests that import Profile / ProfileUpdate
export const Profile = Type.Object({
	id: Type.String({ format: 'uuid' }),
	userId: Type.String({ format: 'uuid' }),
	displayName: Type.String(),
	bio: Type.Union([Type.String(), Type.Null()]),
	location: Type.Union([Type.String(), Type.Null()]),
	profilePhotoKey: Type.Union([Type.String(), Type.Null()]),
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
});

export const ProfileUpdate = Type.Object(
	{
		displayName: Type.Optional(Type.String()),
		bio: Type.Optional(Type.String()),
		location: Type.Optional(Type.String()),
		profilePhotoKey: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export type ProfileCreateType = Static<typeof ProfileCreate>;
export type ProfileReplaceType = Static<typeof ProfileReplace>;
export type ProfilePatchType = Static<typeof ProfilePatch>;
export type ProfilePublicType = Static<typeof ProfilePublic>;
export type ProfilePrivateType = Static<typeof ProfilePrivate>;
export type ContributionAvailabilityType = Static<typeof ContributionAvailability>;
export type ProfileType = Static<typeof Profile>;
export type ProfileUpdateType = Static<typeof ProfileUpdate>;
