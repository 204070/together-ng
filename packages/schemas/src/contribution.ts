import { type Static, Type } from '@sinclair/typebox';
import './formats';

export const ContributionStatus = Type.Enum({
	accepted: 'accepted',
	in_progress: 'in_progress',
	completed: 'completed',
	cancelled: 'cancelled',
});

export const ContributionCreate = Type.Object(
	{
		requestId: Type.String({ format: 'uuid' }),
		responseId: Type.Optional(Type.String({ format: 'uuid' })),
	},
	{ additionalProperties: false },
);

export type ContributionStatusType = Static<typeof ContributionStatus>;
export type ContributionCreateType = Static<typeof ContributionCreate>;
