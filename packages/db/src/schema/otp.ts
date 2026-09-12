import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const otpTokens = pgTable(
	'otp_tokens',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		phone: text('phone').notNull(),
		context: text('context').notNull(),
		codeHash: text('code_hash').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		attempts: integer('attempts').notNull().default(0),
		usedAt: timestamp('used_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('otp_tokens_phone_idx').on(table.phone),
		index('otp_tokens_user_id_idx').on(table.userId),
	],
);

export type OtpToken = typeof otpTokens.$inferSelect;
export type NewOtpToken = typeof otpTokens.$inferInsert;
