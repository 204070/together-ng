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

export type ResponseStatusType = Static<typeof ResponseStatus>;
export type RequestResponseCreateType = Static<typeof RequestResponseCreate>;
