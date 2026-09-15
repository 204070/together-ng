import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { userStatus } from './enums';

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		email: text('email').notNull(),
		emailVerified: boolean('email_verified').notNull().default(false),
		phone: text('phone'),
		phoneVerified: boolean('phone_verified').notNull().default(false),
		passwordHash: text('password_hash').notNull(),
		isAdmin: boolean('is_admin').notNull().default(false),
		status: userStatus('status').notNull().default('active'),
		lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
	},
	(table) => [
		index('users_email_idx').on(table.email),
		uniqueIndex('users_email_unique').on(table.email),
		uniqueIndex('users_phone_unique').on(table.phone),
		index('users_status_idx').on(table.status),
	],
);

export const profiles = pgTable(
	'profiles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		displayName: text('display_name').notNull(),
		bio: text('bio'),
		location: text('location'),
		profilePhotoKey: text('profile_photo_key'),
		areasOfInterest: jsonb('areas_of_interest').$type<number[]>().notNull().default([]),
		skills: jsonb('skills').$type<number[]>().notNull().default([]),
		resources: jsonb('resources').$type<string[]>().notNull().default([]),
		contributionAvailability: jsonb('contribution_availability').$type<{
			modality: 'online' | 'in_person' | 'both';
			preferredArea?: string;
			willingToMentor?: boolean;
		} | null>(),
		exactAddress: text('exact_address'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('profiles_user_id_unique').on(table.userId),
		index('profiles_display_name_idx').on(table.displayName),
	],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
