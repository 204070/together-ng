import { type Static, Type } from '@sinclair/typebox';
import './formats';

export const OutcomeResponse = Type.Enum({
	yes_significantly: 'yes_significantly',
	yes_somewhat: 'yes_somewhat',
	not_yet: 'not_yet',
	no: 'no',
});

export const OutcomeSubmit = Type.Object(
	{
		response: OutcomeResponse,
		explanation: Type.Optional(Type.Union([Type.String(), Type.Null()])),
	},
	{ additionalProperties: false },
);

export const OutcomeConfirmation = Type.Object({
	id: Type.String({ format: 'uuid' }),
	contributionId: Type.String({ format: 'uuid' }),
	recipientId: Type.String({ format: 'uuid' }),
	response: OutcomeResponse,
	explanation: Type.Union([Type.String(), Type.Null()]),
	createdAt: Type.String({ format: 'date-time' }),
});

export type OutcomeResponseType = Static<typeof OutcomeResponse>;
export type OutcomeSubmitType = Static<typeof OutcomeSubmit>;
export type OutcomeConfirmationType = Static<typeof OutcomeConfirmation>;
