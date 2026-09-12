import { type Static, Type } from '@sinclair/typebox';
import './formats';

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

export type ProfileType = Static<typeof Profile>;
export type ProfileUpdateType = Static<typeof ProfileUpdate>;
