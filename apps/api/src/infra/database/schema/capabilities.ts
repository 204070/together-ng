import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { digestFrequency, modality, skillLevel } from './enums';
import { categories, skills } from './taxonomy';
import { users } from './users';

export const contributorCapabilities = pgTable(
	'contributor_capabilities',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		categoryId: integer('category_id').references(() => categories.id, {
			onDelete: 'restrict',
		}),
		skillId: integer('skill_id').references(() => skills.id, { onDelete: 'restrict' }),
		skillLevel: skillLevel('skill_level'),
		modality: modality('modality').notNull().default('both'),
		location: text('location'),
		availableToLend: boolean('available_to_lend').notNull().default(false),
		willingToMentor: boolean('willing_to_mentor').notNull().default(false),
		willingToAnswerQuestions: boolean('willing_to_answer_questions').notNull().default(false),
		willingToCollaborate: boolean('willing_to_collaborate').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('contributor_capabilities_user_id_idx').on(table.userId),
		index('contributor_capabilities_category_id_idx').on(table.categoryId),
		index('contributor_capabilities_skill_id_idx').on(table.skillId),
		uniqueIndex('contributor_capabilities_user_category_skill_unique').on(
			table.userId,
			table.categoryId,
			table.skillId,
		),
	],
);

export const notificationPreferences = pgTable(
	'notification_preferences',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		inAppEnabled: boolean('in_app_enabled').notNull().default(true),
		emailEnabled: boolean('email_enabled').notNull().default(false),
		smsEnabled: boolean('sms_enabled').notNull().default(false),
		pushEnabled: boolean('push_enabled').notNull().default(false),
		digestEnabled: boolean('digest_enabled').notNull().default(false),
		digestFrequency: digestFrequency('digest_frequency').default('weekly'),
		notifyNewMatches: boolean('notify_new_matches').notNull().default(true),
		notifyRemote: boolean('notify_remote').notNull().default(true),
		notifyLocal: boolean('notify_local').notNull().default(true),
		notifyResourceLending: boolean('notify_resource_lending').notNull().default(true),
		notifyMentorship: boolean('notify_mentorship').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [uniqueIndex('notification_preferences_user_id_unique').on(table.userId)],
);

export type ContributorCapability = typeof contributorCapabilities.$inferSelect;
export type NewContributorCapability = typeof contributorCapabilities.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences = typeof notificationPreferences.$inferInsert;
