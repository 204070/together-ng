import {
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';

export const categories = pgTable(
	'categories',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		description: text('description'),
		parentId: integer('parent_id'),
		retiredAt: timestamp('retired_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
		}).onDelete('restrict'),
		uniqueIndex('categories_slug_unique').on(table.slug),
		index('categories_parent_id_idx').on(table.parentId),
		index('categories_retired_at_idx').on(table.retiredAt),
	],
);

export const skills = pgTable(
	'skills',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		categoryId: integer('category_id')
			.notNull()
			.references(() => categories.id, { onDelete: 'restrict' }),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		retiredAt: timestamp('retired_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('skills_slug_unique').on(table.slug),
		uniqueIndex('skills_category_name_unique').on(table.categoryId, table.name),
		index('skills_category_id_idx').on(table.categoryId),
		index('skills_retired_at_idx').on(table.retiredAt),
	],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
