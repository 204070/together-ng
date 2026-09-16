import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { contributionStatus, outcomeResponse } from './enums';
import { requestResponses, requests } from './requests';
import { users } from './users';

export const contributions = pgTable(
	'contributions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		requestId: uuid('request_id')
			.notNull()
			.references(() => requests.id, { onDelete: 'restrict' }),
		contributorId: uuid('contributor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		responseId: uuid('response_id').references(() => requestResponses.id, {
			onDelete: 'set null',
		}),
		status: contributionStatus('status').notNull().default('accepted'),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		notes: text('notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('contributions_request_id_idx').on(table.requestId),
		index('contributions_contributor_id_idx').on(table.contributorId),
		index('contributions_status_idx').on(table.status),
	],
);

export const outcomeConfirmations = pgTable(
	'outcome_confirmations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		contributionId: uuid('contribution_id')
			.notNull()
			.references(() => contributions.id, { onDelete: 'cascade' }),
		recipientId: uuid('recipient_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		received: boolean('received').notNull().default(true),
		response: outcomeResponse('response'),
		explanation: text('explanation'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('outcome_confirmations_contribution_id_unique').on(table.contributionId),
		index('outcome_confirmations_recipient_id_idx').on(table.recipientId),
	],
);

export const contributorConfirmations = pgTable(
	'contributor_confirmations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		contributionId: uuid('contribution_id')
			.notNull()
			.references(() => contributions.id, { onDelete: 'cascade' }),
		contributorId: uuid('contributor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		completedAsAgreed: boolean('completed_as_agreed').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('contributor_confirmations_contribution_id_unique').on(table.contributionId),
		index('contributor_confirmations_contributor_id_idx').on(table.contributorId),
	],
);

export type Contribution = typeof contributions.$inferSelect;
export type NewContribution = typeof contributions.$inferInsert;
export type OutcomeConfirmation = typeof outcomeConfirmations.$inferSelect;
export type NewOutcomeConfirmation = typeof outcomeConfirmations.$inferInsert;
export type ContributorConfirmation = typeof contributorConfirmations.$inferSelect;
export type NewContributorConfirmation = typeof contributorConfirmations.$inferInsert;
