import {
	and,
	auditLog,
	categories,
	categoryRelations,
	contributorCapabilities,
	type Db,
	eq,
	inArray,
	isNull,
	or,
	requests,
	skills,
} from '../../../infra/database';

export function toAdminCategoryResponse(row: typeof categories.$inferSelect) {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		description: row.description,
		parentId: row.parentId,
		mergedIntoId: row.mergedIntoId,
		retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export function toAdminSkillResponse(row: typeof skills.$inferSelect) {
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

export function toRelationResponse(row: typeof categoryRelations.$inferSelect) {
	return {
		id: row.id,
		categoryId: row.categoryId,
		relatedCategoryId: row.relatedCategoryId,
		createdAt: row.createdAt.toISOString(),
	};
}

export interface AuditEntry {
	actorId: string;
	action: string;
	entityType: string;
	before?: Record<string, unknown> | null;
	after?: Record<string, unknown> | null;
}

export class CategoryAdminStore {
	constructor(private readonly db: Db) {}

	async listAllCategories() {
		return this.db.select().from(categories).orderBy(categories.name);
	}

	async listAllSkills() {
		return this.db.select().from(skills);
	}

	async findCategoryById(id: number) {
		const rows = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
		return rows[0];
	}

	async findSkillById(id: number) {
		const rows = await this.db.select().from(skills).where(eq(skills.id, id)).limit(1);
		return rows[0];
	}

	async findActiveSiblings(parentId: number | null) {
		const parentCond =
			parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId);
		return this.db
			.select()
			.from(categories)
			.where(and(parentCond, isNull(categories.retiredAt)));
	}

	async findActiveSkillsInCategory(categoryId: number) {
		return this.db
			.select()
			.from(skills)
			.where(and(eq(skills.categoryId, categoryId), isNull(skills.retiredAt)));
	}

	async findCategoryBySlug(slug: string) {
		const rows = await this.db
			.select({ id: categories.id })
			.from(categories)
			.where(eq(categories.slug, slug))
			.limit(1);
		return rows[0];
	}

	async findSkillBySlug(slug: string) {
		const rows = await this.db
			.select({ id: skills.id })
			.from(skills)
			.where(eq(skills.slug, slug))
			.limit(1);
		return rows[0];
	}

	async insertCategory(input: {
		name: string;
		slug: string;
		description: string | null;
		parentId: number | null;
	}) {
		const rows = await this.db.insert(categories).values(input).returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to create category');
		return row;
	}

	async updateCategory(
		id: number,
		patch: {
			name?: string;
			description?: string | null;
			retiredAt?: Date | null;
			mergedIntoId?: number | null;
		},
	) {
		const sets: Record<string, unknown> = { updatedAt: new Date() };
		if (patch.name !== undefined) sets.name = patch.name;
		if (patch.description !== undefined) sets.description = patch.description;
		if (patch.retiredAt !== undefined) sets.retiredAt = patch.retiredAt;
		if (patch.mergedIntoId !== undefined) sets.mergedIntoId = patch.mergedIntoId;
		const rows = await this.db
			.update(categories)
			.set(sets)
			.where(eq(categories.id, id))
			.returning();
		return rows[0];
	}

	async insertSkill(input: { categoryId: number; name: string; slug: string }) {
		const rows = await this.db.insert(skills).values(input).returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to create skill');
		return row;
	}

	async updateSkill(id: number, patch: { name?: string; retiredAt?: Date | null }) {
		const sets: Record<string, unknown> = { updatedAt: new Date() };
		if (patch.name !== undefined) sets.name = patch.name;
		if (patch.retiredAt !== undefined) sets.retiredAt = patch.retiredAt;
		const rows = await this.db.update(skills).set(sets).where(eq(skills.id, id)).returning();
		return rows[0];
	}

	async reassignRequests(sourceId: number, targetId: number): Promise<number> {
		const rows = await this.db
			.update(requests)
			.set({ categoryId: targetId, updatedAt: new Date() })
			.where(eq(requests.categoryId, sourceId))
			.returning({ id: requests.id });
		return rows.length;
	}

	async listCapabilitiesInCategory(categoryId: number) {
		return this.db
			.select()
			.from(contributorCapabilities)
			.where(eq(contributorCapabilities.categoryId, categoryId));
	}

	async reassignCapability(id: string, targetId: number): Promise<void> {
		await this.db
			.update(contributorCapabilities)
			.set({ categoryId: targetId, updatedAt: new Date() })
			.where(eq(contributorCapabilities.id, id));
	}

	async deleteCapability(id: string): Promise<void> {
		await this.db.delete(contributorCapabilities).where(eq(contributorCapabilities.id, id));
	}

	async countRequestsInCategory(categoryId: number): Promise<number> {
		const rows = await this.db
			.select({ id: requests.id })
			.from(requests)
			.where(eq(requests.categoryId, categoryId));
		return rows.length;
	}

	async listRelationsForCategory(id: number) {
		return this.db
			.select()
			.from(categoryRelations)
			.where(or(eq(categoryRelations.categoryId, id), eq(categoryRelations.relatedCategoryId, id)));
	}

	async findRelationBetween(a: number, b: number) {
		const lo = Math.min(a, b);
		const hi = Math.max(a, b);
		const rows = await this.db
			.select()
			.from(categoryRelations)
			.where(
				or(
					and(eq(categoryRelations.categoryId, lo), eq(categoryRelations.relatedCategoryId, hi)),
					and(eq(categoryRelations.categoryId, hi), eq(categoryRelations.relatedCategoryId, lo)),
				),
			)
			.limit(1);
		return rows[0];
	}

	async insertRelation(categoryId: number, relatedCategoryId: number) {
		const lo = Math.min(categoryId, relatedCategoryId);
		const hi = Math.max(categoryId, relatedCategoryId);
		const rows = await this.db
			.insert(categoryRelations)
			.values({ categoryId: lo, relatedCategoryId: hi })
			.returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to create category relation');
		return row;
	}

	async categoriesByIds(ids: number[]) {
		if (ids.length === 0) return [];
		return this.db.select().from(categories).where(inArray(categories.id, ids));
	}

	async writeAudit(entry: AuditEntry): Promise<void> {
		await this.db.insert(auditLog).values({
			actorId: entry.actorId,
			action: entry.action,
			entityType: entry.entityType,
			entityId: null,
			before: entry.before ?? null,
			after: entry.after ?? null,
		});
	}
}
