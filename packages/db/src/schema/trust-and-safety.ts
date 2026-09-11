import { bigserial, index, inet, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { moderationActionType, reportStatus, reportSubjectType, severity } from './enums';
import { users } from './users';

export const reports = pgTable(
	'reports',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
		subjectType: reportSubjectType('subject_type').notNull(),
		subjectId: uuid('subject_id').notNull(),
		reason: text('reason').notNull(),
		description: text('description'),
		status: reportStatus('status').notNull().default('pending'),
		resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('reports_reporter_id_idx').on(table.reporterId),
		index('reports_subject_idx').on(table.subjectType, table.subjectId),
		index('reports_status_idx').on(table.status),
	],
);

export const moderationActions = pgTable(
	'moderation_actions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		targetUserId: uuid('target_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		action: moderationActionType('action').notNull(),
		severity: severity('severity').notNull().default('low'),
		reason: text('reason'),
		performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('moderation_actions_target_user_id_idx').on(table.targetUserId),
		index('moderation_actions_action_idx').on(table.action),
	],
);

export const auditLog = pgTable(
	'audit_log',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
		action: text('action').notNull(),
		entityType: text('entity_type'),
		entityId: uuid('entity_id'),
		before: jsonb('before'),
		after: jsonb('after'),
		ipAddress: inet('ip_address'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('audit_log_actor_id_idx').on(table.actorId),
		index('audit_log_entity_idx').on(table.entityType, table.entityId),
		index('audit_log_created_at_idx').on(table.createdAt),
	],
);

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ModerationAction = typeof moderationActions.$inferSelect;
export type NewModerationAction = typeof moderationActions.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
