import { type SQL, sql } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	vector,
} from 'drizzle-orm/pg-core';
import { helpType, modality, requestState, responseStatus, skillLevel, tsvector } from './enums';
import { categories } from './taxonomy';
import { users } from './users';

export const requests = pgTable(
	'requests',
	(_table) => ({
		id: uuid('id').primaryKey().defaultRandom(),
		authorId: uuid('author_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		categoryId: integer('category_id').references(() => categories.id, {
			onDelete: 'restrict',
		}),
		title: text('title').notNull(),
		goal: text('goal').notNull(),
		barrier: text('barrier').notNull(),
		helpNeeded: text('help_needed').notNull(),
		state: requestState('state').notNull().default('draft'),
		modality: modality('modality').default('both'),
		helpType: helpType('help_type'),
		location: text('location'),
		timeCommitment: text('time_commitment'),
		duration: text('duration'),
		deadline: timestamp('deadline', { withTimezone: true }),
		skillLevel: skillLevel('skill_level'),
		intendedOutcome: text('intended_outcome'),
		quantity: text('quantity'),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		closedAt: timestamp('closed_at', { withTimezone: true }),
		closedReason: text('closed_reason'),
		underReview: boolean('under_review').notNull().default(false),
		searchVector: tsvector('search_vector').generatedAlwaysAs(
			(): SQL =>
				sql`to_tsvector('simple', coalesce(${requests.title}, '') || ' ' || coalesce(${requests.goal}, '') || ' ' || coalesce(${requests.barrier}, '') || ' ' || coalesce(${requests.helpNeeded}, ''))`,
		),
		embedding: vector('embedding', { dimensions: 384 }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	}),
	(table) => [
		index('requests_author_id_idx').on(table.authorId),
		index('requests_category_id_idx').on(table.categoryId),
		index('requests_state_idx').on(table.state),
		index('requests_created_at_idx').on(table.createdAt),
		index('requests_search_vector_idx').using('gin', table.searchVector),
	],
);

export const requestResponses = pgTable(
	'request_responses',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		requestId: uuid('request_id')
			.notNull()
			.references(() => requests.id, { onDelete: 'cascade' }),
		contributorId: uuid('contributor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		message: text('message').notNull(),
		modality: modality('modality'),
		status: responseStatus('status').notNull().default('pending'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('request_responses_request_id_idx').on(table.requestId),
		index('request_responses_contributor_id_idx').on(table.contributorId),
		index('request_responses_status_idx').on(table.status),
		uniqueIndex('request_responses_request_contributor_unique').on(
			table.requestId,
			table.contributorId,
		),
	],
);

export const votes = pgTable(
	'votes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		requestId: uuid('request_id')
			.notNull()
			.references(() => requests.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique('votes_user_request_unique').on(table.userId, table.requestId),
		index('votes_request_id_idx').on(table.requestId),
	],
);

export const requestMatches = pgTable(
	'request_matches',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		requestId: uuid('request_id')
			.notNull()
			.references(() => requests.id, { onDelete: 'cascade' }),
		contributorId: uuid('contributor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		score: numeric('score').notNull(),
		reasons: jsonb('reasons'),
		notifiedAt: timestamp('notified_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('request_matches_request_contributor_unique').on(
			table.requestId,
			table.contributorId,
		),
		index('request_matches_contributor_id_idx').on(table.contributorId),
	],
);

export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;
export type RequestResponse = typeof requestResponses.$inferSelect;
export type NewRequestResponse = typeof requestResponses.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;
export type RequestMatch = typeof requestMatches.$inferSelect;
export type NewRequestMatch = typeof requestMatches.$inferInsert;
