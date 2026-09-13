import { type Static, Type } from '@sinclair/typebox';
import './formats';

export const RequestState = Type.Enum({
	draft: 'draft',
	published: 'published',
	receiving_responses: 'receiving_responses',
	help_arranged: 'help_arranged',
	in_progress: 'in_progress',
	completed: 'completed',
	closed: 'closed',
	cancelled: 'cancelled',
	archived: 'archived',
	under_review: 'under_review',
});

const modality = Type.Enum({
	online: 'online',
	in_person: 'in_person',
	both: 'both',
});

const helpType = Type.Enum({
	borrow: 'borrow',
	receive: 'receive',
	access: 'access',
	learn: 'learn',
	collaborate: 'collaborate',
});

const skillLevel = Type.Enum({
	beginner: 'beginner',
	intermediate: 'intermediate',
	advanced: 'advanced',
});

const title = Type.String({ minLength: 1, maxLength: 200, pattern: '\\S' });

const requestText = Type.String({ minLength: 1, maxLength: 2000, pattern: '\\S' });

export const RequestCreate = Type.Object(
	{
		title,
		goal: requestText,
		barrier: requestText,
		helpNeeded: requestText,
		categoryId: Type.Integer({ minimum: 1 }),
		modality: Type.Optional(modality),
		helpType: Type.Optional(helpType),
		location: Type.Optional(Type.String()),
		deadline: Type.Optional(Type.String({ format: 'date-time' })),
		timeCommitment: Type.Optional(Type.String()),
		duration: Type.Optional(Type.String()),
		skillLevel: Type.Optional(skillLevel),
		quantity: Type.Optional(Type.String()),
		intendedOutcome: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export const Request = Type.Object({
	id: Type.String({ format: 'uuid' }),
	authorId: Type.String({ format: 'uuid' }),
	categoryId: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
	title,
	goal: requestText,
	barrier: requestText,
	helpNeeded: requestText,
	state: RequestState,
	modality: Type.Union([modality, Type.Null()]),
	helpType: Type.Union([helpType, Type.Null()]),
	location: Type.Union([Type.String(), Type.Null()]),
	timeCommitment: Type.Union([Type.String(), Type.Null()]),
	duration: Type.Union([Type.String(), Type.Null()]),
	deadline: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	skillLevel: Type.Union([skillLevel, Type.Null()]),
	intendedOutcome: Type.Union([Type.String(), Type.Null()]),
	quantity: Type.Union([Type.String(), Type.Null()]),
	publishedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	closedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	closedReason: Type.Union([Type.String(), Type.Null()]),
	underReview: Type.Boolean(),
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
});

export const RequestDraftCreate = Type.Object(
	{
		title: Type.Optional(title),
		goal: Type.Optional(requestText),
		barrier: Type.Optional(requestText),
		helpNeeded: Type.Optional(requestText),
		categoryId: Type.Optional(Type.Integer({ minimum: 1 })),
		modality: Type.Optional(modality),
		helpType: Type.Optional(helpType),
		location: Type.Optional(Type.String()),
		deadline: Type.Optional(Type.String({ format: 'date-time' })),
		timeCommitment: Type.Optional(Type.String()),
		duration: Type.Optional(Type.String()),
		skillLevel: Type.Optional(skillLevel),
		quantity: Type.Optional(Type.String()),
		intendedOutcome: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export const RequestPatch = Type.Object(
	{
		title: Type.Optional(title),
		goal: Type.Optional(requestText),
		barrier: Type.Optional(requestText),
		helpNeeded: Type.Optional(requestText),
		categoryId: Type.Optional(Type.Integer({ minimum: 1 })),
		modality: Type.Optional(modality),
		helpType: Type.Optional(helpType),
		location: Type.Optional(Type.String()),
		deadline: Type.Optional(Type.String({ format: 'date-time' })),
		timeCommitment: Type.Optional(Type.String()),
		duration: Type.Optional(Type.String()),
		skillLevel: Type.Optional(skillLevel),
		quantity: Type.Optional(Type.String()),
		intendedOutcome: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);

export const DraftResponse = Type.Intersect([
	Request,
	Type.Object({ qualityHints: Type.Array(Type.String()) }),
]);

export const RequestPreview = Type.Object({
	request: Request,
	missingFields: Type.Array(Type.String()),
	qualityHints: Type.Array(Type.String()),
});

export type RequestStateType = Static<typeof RequestState>;
export type RequestCreateType = Static<typeof RequestCreate>;
export type RequestDraftCreateType = Static<typeof RequestDraftCreate>;
export type RequestPatchType = Static<typeof RequestPatch>;
export type DraftResponseType = Static<typeof DraftResponse>;
export type RequestPreviewType = Static<typeof RequestPreview>;
export type RequestType = Static<typeof Request>;
