import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { notificationType } from './enums';
import { requests } from './requests';
import { users } from './users';

export const notifications = pgTable(
	'notifications',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		requestId: uuid('request_id').references(() => requests.id, { onDelete: 'cascade' }),
		type: notificationType('type').notNull(),
		title: text('title').notNull(),
		body: text('body'),
		data: jsonb('data'),
		readAt: timestamp('read_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('notifications_user_id_idx').on(table.userId),
		index('notifications_user_read_idx').on(table.userId, table.readAt),
		index('notifications_user_type_created_at_idx').on(table.userId, table.type, table.createdAt),
		uniqueIndex('notifications_request_user_unique').on(table.requestId, table.userId),
	],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export const notificationDispatchLog = pgTable(
	'notification_dispatch_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		requestId: uuid('request_id')
			.notNull()
			.references(() => requests.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		matchFactors: jsonb('match_factors'),
		decision: text('decision').notNull(),
		reason: text('reason'),
		capsEvaluated: jsonb('caps_evaluated'),
		capWindow: text('cap_window'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('notification_dispatch_log_request_id_idx').on(table.requestId),
		index('notification_dispatch_log_user_id_idx').on(table.userId),
		index('notification_dispatch_log_created_at_idx').on(table.createdAt),
	],
);

export type NotificationDispatchLog = typeof notificationDispatchLog.$inferSelect;
export type NewNotificationDispatchLog = typeof notificationDispatchLog.$inferInsert;
