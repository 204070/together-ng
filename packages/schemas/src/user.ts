import { type Static, Type } from '@sinclair/typebox';
import './formats';

const userStatus = {
	active: 'active',
	suspended: 'suspended',
	banned: 'banned',
	deactivated: 'deactivated',
};

export const RegisterRequest = Type.Object(
	{
		email: Type.String({ format: 'email' }),
		password: Type.String({ minLength: 8 }),
		phone: Type.Optional(Type.String({ format: 'e164' })),
	},
	{ additionalProperties: false },
);

const sharedUserFields = {
	id: Type.String({ format: 'uuid' }),
	status: Type.Enum(userStatus),
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
};

export const UserPrivate = Type.Object({
	...sharedUserFields,
	email: Type.String({ format: 'email' }),
	emailVerified: Type.Boolean(),
	phone: Type.Union([Type.String({ format: 'e164' }), Type.Null()]),
	phoneVerified: Type.Boolean(),
	lastLoginAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	deletedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});

export const UserPublic = Type.Object(sharedUserFields);

export type RegisterRequestType = Static<typeof RegisterRequest>;
export type UserPrivateType = Static<typeof UserPrivate>;
export type UserPublicType = Static<typeof UserPublic>;
