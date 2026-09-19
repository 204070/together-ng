import { and, categories, type Db, eq, isNotNull, isNull, skills } from '../../infra/database';

export interface CategoryFilters {
	parentId?: number | null;
	activeOnly?: boolean;
	active?: boolean | null;
	includeRetired?: boolean | null;
}

export function toCategoryResponse(row: typeof categories.$inferSelect) {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		description: row.description,
		parentId: row.parentId,
		retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export function toSkillResponse(row: typeof skills.$inferSelect) {
	return {
		id: row.id,
		categoryId: row.categoryId,
		name: row.name,
		slug: row.slug,
		retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export class TaxonomyStore {
	constructor(private readonly db: Db) {}

	async listCategories(filters: CategoryFilters = {}) {
		const conditions = [];
		if (filters.parentId !== undefined) {
			if (filters.parentId === null) conditions.push(isNull(categories.parentId));
			else conditions.push(eq(categories.parentId, filters.parentId));
		}
		const includeRetired = filters.includeRetired === true || filters.active === false;
		const activeOnly = filters.activeOnly ?? !includeRetired;
		if (filters.active === true) conditions.push(isNull(categories.retiredAt));
		else if (filters.active === false) conditions.push(isNotNull(categories.retiredAt));
		else if (activeOnly) conditions.push(isNull(categories.retiredAt));
		const rows =
			conditions.length > 0
				? await this.db
						.select()
						.from(categories)
						.where(and(...conditions))
						.orderBy(categories.name)
				: await this.db.select().from(categories).orderBy(categories.name);
		return rows;
	}

	async listActiveSkills(categoryId: number) {
		return this.db
			.select()
			.from(skills)
			.where(and(eq(skills.categoryId, categoryId), isNull(skills.retiredAt)))
			.orderBy(skills.name);
	}
}
