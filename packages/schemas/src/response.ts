import { type Static, Type } from '@sinclair/typebox';
import './formats';

export const ResponseStatus = Type.Enum({
	pending: 'pending',
	accepted: 'accepted',
	declined: 'declined',
	withdrawn: 'withdrawn',
});

const modality = Type.Enum({
	online: 'online',
	in_person: 'in_person',
	both: 'both',
});

export const RequestResponseCreate = Type.Object(
	{
		requestId: Type.String({ format: 'uuid' }),
		message: Type.String({ minLength: 1 }),
		modality: Type.Optional(modality),
	},
	{ additionalProperties: false },
);

export const OfferCreate = Type.Object(
	{
		message: Type.String({ minLength: 1, maxLength: 2000 }),
		anonymous: Type.Optional(Type.Boolean()),
		modality: Type.Optional(modality),
	},
	{ additionalProperties: false },
);

export const OfferAction = Type.Object(
	{
		note: Type.Optional(Type.String({ maxLength: 2000 })),
	},
	{ additionalProperties: false },
);

export type ResponseStatusType = Static<typeof ResponseStatus>;
export type RequestResponseCreateType = Static<typeof RequestResponseCreate>;
export type OfferCreateType = Static<typeof OfferCreate>;
export type OfferActionType = Static<typeof OfferAction>;
