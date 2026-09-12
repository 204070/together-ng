import { type Static, Type } from '@sinclair/typebox';
import './formats';

export const VoteCreate = Type.Object(
	{
		requestId: Type.String({ format: 'uuid' }),
	},
	{ additionalProperties: false },
);

export type VoteCreateType = Static<typeof VoteCreate>;
