import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const badges = pgTable(
	'badges',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description'),
		icon: text('icon'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('badges_name_unique').on(table.name),
		uniqueIndex('badges_slug_unique').on(table.slug),
	],
);

export const userBadges = pgTable(
	'user_badges',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		badgeId: integer('badge_id')
			.notNull()
			.references(() => badges.id, { onDelete: 'cascade' }),
		awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('user_badges_user_badge_unique').on(table.userId, table.badgeId),
		index('user_badges_badge_id_idx').on(table.badgeId),
	],
);

export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;
export type UserBadge = typeof userBadges.$inferSelect;
export type NewUserBadge = typeof userBadges.$inferInsert;
