import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
	conditionPhase,
	lendingStatus,
	resourceAvailability,
	resourceKind,
	resourceStatus,
} from './enums';
import { categories } from './taxonomy';
import { users } from './users';

export const resources = pgTable(
	'resources',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ownerId: uuid('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		categoryId: integer('category_id').references(() => categories.id, {
			onDelete: 'restrict',
		}),
		title: text('title').notNull(),
		description: text('description'),
		kind: resourceKind('kind').notNull(),
		condition: text('condition'),
		location: text('location'),
		availability: resourceAvailability('availability').notNull(),
		lendingTerms: text('lending_terms'),
		photoKeys: text('photo_keys').array(),
		highValue: boolean('high_value').notNull().default(false),
		status: resourceStatus('status').notNull().default('available'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('resources_owner_id_idx').on(table.ownerId),
		index('resources_category_id_idx').on(table.categoryId),
		index('resources_kind_idx').on(table.kind),
	],
);

export const lendingAgreements = pgTable(
	'lending_agreements',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		resourceId: uuid('resource_id')
			.notNull()
			.references(() => resources.id, { onDelete: 'restrict' }),
		ownerId: uuid('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		borrowerId: uuid('borrower_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		status: lendingStatus('status').notNull().default('requested'),
		terms: text('terms'),
		lendingPeriod: text('lending_period'),
		returnExpectations: text('return_expectations'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('lending_agreements_resource_id_idx').on(table.resourceId),
		index('lending_agreements_owner_id_idx').on(table.ownerId),
		index('lending_agreements_borrower_id_idx').on(table.borrowerId),
	],
);

export const conditionRecords = pgTable(
	'condition_records',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		lendingAgreementId: uuid('lending_agreement_id')
			.notNull()
			.references(() => lendingAgreements.id, { onDelete: 'cascade' }),
		recordedBy: uuid('recorded_by')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		phase: conditionPhase('phase').notNull(),
		description: text('description'),
		photoKeys: text('photo_keys').array(),
		acknowledged: boolean('acknowledged').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index('condition_records_lending_agreement_id_idx').on(table.lendingAgreementId)],
);

export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type LendingAgreement = typeof lendingAgreements.$inferSelect;
export type NewLendingAgreement = typeof lendingAgreements.$inferInsert;
export type ConditionRecord = typeof conditionRecords.$inferSelect;
export type NewConditionRecord = typeof conditionRecords.$inferInsert;
