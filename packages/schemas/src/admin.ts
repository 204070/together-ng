import { type Static, Type } from '@sinclair/typebox';
import { Category, Skill } from './category';
import './formats';

export const AdminMe = Type.Object({
	id: Type.String({ format: 'uuid' }),
	email: Type.String({ format: 'email' }),
	isAdmin: Type.Boolean(),
});
export type AdminMeType = Static<typeof AdminMe>;

export const ReportSubjectType = Type.Enum({
	request: 'request',
	profile: 'profile',
	contribution: 'contribution',
	message: 'message',
	resource: 'resource',
	resource_listing: 'resource_listing',
	lending_agreement: 'lending_agreement',
});
export type ReportSubjectTypeValue = Static<typeof ReportSubjectType>;

export const ReportStatus = Type.Enum({
	pending: 'pending',
	under_review: 'under_review',
	resolved: 'resolved',
	dismissed: 'dismissed',
});
export type ReportStatusValue = Static<typeof ReportStatus>;

/** Moderation actions as stored in `moderation_actions` (DB mirror). */
export const ModerationActionType = Type.Enum({
	warning: 'warning',
	suspend: 'suspend',
	restore: 'restore',
	restrict: 'restrict',
	ban: 'ban',
	remove_content: 'remove_content',
	feature: 'feature',
	investigate: 'investigate',
});
export type ModerationActionTypeValue = Static<typeof ModerationActionType>;

/**
 * Actions an admin can take from a report detail view (issue #19).
 * `dismiss` closes the report with no action against the target user.
 */
export const ReportAction = Type.Enum({
	warn: 'warn',
	restrict: 'restrict',
	suspend: 'suspend',
	restore: 'restore',
	dismiss: 'dismiss',
});
export type ReportActionValue = Static<typeof ReportAction>;

export const ReportListItem = Type.Object({
	id: Type.String({ format: 'uuid' }),
	reason: Type.String(),
	category: ReportSubjectType,
	status: ReportStatus,
	createdAt: Type.String({ format: 'date-time' }),
	subjectId: Type.String({ format: 'uuid' }),
});
export type ReportListItemType = Static<typeof ReportListItem>;

export const AdminReports = Type.Object({
	reports: Type.Array(ReportListItem),
	total: Type.Integer({ minimum: 0 }),
});
export type AdminReportsType = Static<typeof AdminReports>;

const categoryName = Type.String({ minLength: 1, maxLength: 100, pattern: '\\S' });
const skillName = Type.String({ minLength: 1, maxLength: 100, pattern: '\\S' });
const nullableDateTime = Type.Union([Type.String({ format: 'date-time' }), Type.Null()]);
const nullableInt = Type.Union([Type.Integer(), Type.Null()]);

export const CategoryWithCounts = Type.Object({
	id: Type.Integer(),
	name: Type.String(),
	slug: Type.String(),
	description: Type.Union([Type.String(), Type.Null()]),
	parentId: nullableInt,
	mergedIntoId: nullableInt,
	retiredAt: nullableDateTime,
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
	subcategoryCount: Type.Integer(),
	skillCount: Type.Integer(),
});
export type CategoryWithCountsType = Static<typeof CategoryWithCounts>;

export const CategoryList = Type.Array(CategoryWithCounts);

export const AdminCategory = Type.Object({
	id: Type.Integer(),
	name: Type.String(),
	slug: Type.String(),
	description: Type.Union([Type.String(), Type.Null()]),
	parentId: nullableInt,
	mergedIntoId: nullableInt,
	retiredAt: nullableDateTime,
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminCategoryType = Static<typeof AdminCategory>;

export const CreateCategoryInput = Type.Object(
	{
		name: categoryName,
		description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
		parentId: Type.Optional(nullableInt),
	},
	{ additionalProperties: false },
);
export type CreateCategoryInputType = Static<typeof CreateCategoryInput>;

export const UpdateCategoryInput = Type.Object(
	{
		name: Type.Optional(categoryName),
		description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
		retiredAt: Type.Optional(nullableDateTime),
	},
	{ additionalProperties: false },
);
export type UpdateCategoryInputType = Static<typeof UpdateCategoryInput>;

export const CreateSkillInput = Type.Object({ name: skillName }, { additionalProperties: false });
export type CreateSkillInputType = Static<typeof CreateSkillInput>;

export const UpdateSkillInput = Type.Object(
	{
		name: Type.Optional(skillName),
		retiredAt: Type.Optional(nullableDateTime),
	},
	{ additionalProperties: false },
);
export type UpdateSkillInputType = Static<typeof UpdateSkillInput>;

export const MergeCategoriesInput = Type.Object(
	{ targetId: Type.Integer() },
	{ additionalProperties: false },
);
export type MergeCategoriesInputType = Static<typeof MergeCategoriesInput>;

export const RelatedCategoryInput = Type.Object(
	{ relatedId: Type.Integer() },
	{ additionalProperties: false },
);
export type RelatedCategoryInputType = Static<typeof RelatedCategoryInput>;

export const CategoryRelation = Type.Object({
	id: Type.String({ format: 'uuid' }),
	categoryId: Type.Integer(),
	relatedCategoryId: Type.Integer(),
	createdAt: Type.String({ format: 'date-time' }),
});
export type CategoryRelationType = Static<typeof CategoryRelation>;

export const CategoryDetail = Type.Object({
	...Category.properties,
	mergedIntoId: nullableInt,
	subcategories: Type.Array(CategoryWithCounts),
	skills: Type.Array(Skill),
	relatedCategories: Type.Array(Category),
});
export type CategoryDetailType = Static<typeof CategoryDetail>;

export const ReportDetail = Type.Object({
	id: Type.String({ format: 'uuid' }),
	reason: Type.String(),
	description: Type.Union([Type.String(), Type.Null()]),
	category: ReportSubjectType,
	status: ReportStatus,
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
	subjectId: Type.String({ format: 'uuid' }),
	subjectSnapshot: Type.Unknown(),
	resolvedBy: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
	resolvedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});
export type ReportDetailType = Static<typeof ReportDetail>;

export const ReportActionInput = Type.Object(
	{
		action: ReportAction,
		reason: Type.Optional(Type.String({ minLength: 1, maxLength: 2000 })),
		expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
	},
	{ additionalProperties: false },
);
export type ReportActionInputType = Static<typeof ReportActionInput>;

export const ReportActionResponse = Type.Object({
	success: Type.Boolean(),
	report: ReportDetail,
});
export type ReportActionResponseType = Static<typeof ReportActionResponse>;

export const AuditLogEntry = Type.Object({
	id: Type.Number(),
	actorId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
	actorEmail: Type.Union([Type.String({ format: 'email' }), Type.Null()]),
	action: Type.String(),
	entityType: Type.Union([Type.String(), Type.Null()]),
	entityId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
	before: Type.Union([Type.Unknown(), Type.Null()]),
	after: Type.Union([Type.Unknown(), Type.Null()]),
	ipAddress: Type.Union([Type.String(), Type.Null()]),
	createdAt: Type.String({ format: 'date-time' }),
});
export type AuditLogEntryType = Static<typeof AuditLogEntry>;

export const AuditLogResponse = Type.Object({
	entries: Type.Array(AuditLogEntry),
	total: Type.Integer({ minimum: 0 }),
	page: Type.Integer({ minimum: 1 }),
	limit: Type.Integer({ minimum: 1, maximum: 100 }),
});
export type AuditLogResponseType = Static<typeof AuditLogResponse>;

export const AuditLogQuery = Type.Object(
	{
		page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
		limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 25 })),
		actorId: Type.Optional(Type.String({ format: 'uuid' })),
		entityType: Type.Optional(Type.String()),
		entityId: Type.Optional(Type.String({ format: 'uuid' })),
		action: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
);
export type AuditLogQueryType = Static<typeof AuditLogQuery>;

export const ReportsQuery = Type.Object(
	{
		page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
		limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 25 })),
		status: Type.Optional(ReportStatus),
		category: Type.Optional(ReportSubjectType),
	},
	{ additionalProperties: false },
);
export type ReportsQueryType = Static<typeof ReportsQuery>;
