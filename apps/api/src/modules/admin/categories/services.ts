import type {
	CreateCategoryInputType,
	CreateSkillInputType,
	MergeCategoriesInput,
	RelatedCategoryInput,
	Static,
	UpdateCategoryInputType,
	UpdateSkillInputType,
} from '@together/schemas';
import { HttpError } from '../../../lib/errors';
import {
	type CategoryAdminStore,
	toAdminCategoryResponse,
	toAdminSkillResponse,
	toRelationResponse,
} from './store';

function notFound(message: string): HttpError {
	return new HttpError(404, 'NOT_FOUND', undefined, undefined, message);
}

function conflict(code: string, message: string): HttpError {
	return new HttpError(409, code, undefined, undefined, message);
}

function badRequest(code: string, message: string): HttpError {
	return new HttpError(400, code, undefined, undefined, message);
}

export function slugify(name: string): string {
	const slug = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return slug || 'item';
}

function sameName(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}

export class CategoryAdminService {
	constructor(public readonly store: CategoryAdminStore) {}

	private async uniqueCategorySlug(base: string): Promise<string> {
		let slug = base;
		let n = 2;
		while (await this.store.findCategoryBySlug(slug)) {
			slug = `${base}-${n}`;
			n += 1;
		}
		return slug;
	}

	private async uniqueSkillSlug(base: string): Promise<string> {
		let slug = base;
		let n = 2;
		while (await this.store.findSkillBySlug(slug)) {
			slug = `${base}-${n}`;
			n += 1;
		}
		return slug;
	}

	async listCategories() {
		const [allCategories, allSkills] = await Promise.all([
			this.store.listAllCategories(),
			this.store.listAllSkills(),
		]);
		const subCounts = new Map<number, number>();
		const skillCounts = new Map<number, number>();
		for (const c of allCategories) {
			if (c.parentId !== null && c.retiredAt === null) {
				subCounts.set(c.parentId, (subCounts.get(c.parentId) ?? 0) + 1);
			}
		}
		for (const s of allSkills) {
			if (s.retiredAt === null) {
				skillCounts.set(s.categoryId, (skillCounts.get(s.categoryId) ?? 0) + 1);
			}
		}
		return allCategories.map((c) => ({
			...toAdminCategoryResponse(c),
			subcategoryCount: subCounts.get(c.id) ?? 0,
			skillCount: skillCounts.get(c.id) ?? 0,
		}));
	}

	async createCategory(actorId: string, b: CreateCategoryInputType) {
		const parentId = b.parentId ?? null;
		if (parentId !== null) {
			const parent = await this.store.findCategoryById(parentId);
			if (!parent) throw notFound('Parent category not found');
		}
		const siblings = await this.store.findActiveSiblings(parentId);
		if (siblings.some((s) => sameName(s.name, b.name))) {
			throw conflict('CATEGORY_NAME_TAKEN', 'An active category with this name already exists');
		}
		const slug = await this.uniqueCategorySlug(slugify(b.name));
		const row = await this.store.insertCategory({
			name: b.name,
			slug,
			description: b.description ?? null,
			parentId,
		});
		await this.store.writeAudit({
			actorId,
			action: 'category.create',
			entityType: 'category',
			after: { id: row.id, name: row.name, slug, parentId },
		});
		return toAdminCategoryResponse(row);
	}

	async getCategoryDetail(id: number) {
		const row = await this.store.findCategoryById(id);
		if (!row) throw notFound('Category not found');
		const [allCategories, allSkills, relations] = await Promise.all([
			this.store.listAllCategories(),
			this.store.listAllSkills(),
			this.store.listRelationsForCategory(id),
		]);
		const subCounts = new Map<number, number>();
		const skillCounts = new Map<number, number>();
		for (const c of allCategories) {
			if (c.parentId !== null && c.retiredAt === null) {
				subCounts.set(c.parentId, (subCounts.get(c.parentId) ?? 0) + 1);
			}
		}
		for (const s of allSkills) {
			if (s.retiredAt === null) {
				skillCounts.set(s.categoryId, (skillCounts.get(s.categoryId) ?? 0) + 1);
			}
		}
		const subcategories = allCategories
			.filter((c) => c.parentId === id)
			.map((c) => ({
				...toAdminCategoryResponse(c),
				subcategoryCount: subCounts.get(c.id) ?? 0,
				skillCount: skillCounts.get(c.id) ?? 0,
			}));
		const skills = allSkills.filter((s) => s.categoryId === id).map(toAdminSkillResponse);
		const otherIds = relations.map((r) =>
			r.categoryId === id ? r.relatedCategoryId : r.categoryId,
		);
		const relatedRows = await this.store.categoriesByIds(otherIds);
		return {
			...toAdminCategoryResponse(row),
			subcategories,
			skills,
			relatedCategories: relatedRows.map((r) => ({
				id: r.id,
				name: r.name,
				slug: r.slug,
				description: r.description,
				parentId: r.parentId,
				retiredAt: r.retiredAt ? r.retiredAt.toISOString() : null,
				createdAt: r.createdAt.toISOString(),
				updatedAt: r.updatedAt.toISOString(),
			})),
		};
	}

	async updateCategory(actorId: string, id: number, b: UpdateCategoryInputType) {
		const row = await this.store.findCategoryById(id);
		if (!row) throw notFound('Category not found');
		if (b.name !== undefined) {
			const name = b.name;
			const siblings = await this.store.findActiveSiblings(row.parentId);
			if (siblings.some((s) => s.id !== id && sameName(s.name, name))) {
				throw conflict('CATEGORY_NAME_TAKEN', 'An active category with this name already exists');
			}
		}
		if (b.retiredAt !== undefined) {
			if (b.retiredAt !== null && row.retiredAt !== null) {
				throw badRequest('CATEGORY_ALREADY_RETIRED', 'Category is already retired');
			}
		}
		const patch: { name?: string; description?: string | null; retiredAt?: Date | null } = {};
		if (b.name !== undefined) patch.name = b.name;
		if (b.description !== undefined) patch.description = b.description;
		if (b.retiredAt !== undefined) {
			patch.retiredAt = b.retiredAt === null ? null : new Date(b.retiredAt);
		}
		const before = { id: row.id, name: row.name, retiredAt: row.retiredAt?.toISOString() ?? null };
		const updated = await this.store.updateCategory(id, patch);
		if (!updated) throw notFound('Category not found');
		await this.store.writeAudit({
			actorId,
			action:
				b.retiredAt !== undefined && b.retiredAt !== null ? 'category.retire' : 'category.update',
			entityType: 'category',
			before,
			after: {
				id: updated.id,
				name: updated.name,
				retiredAt: updated.retiredAt?.toISOString() ?? null,
			},
		});
		return toAdminCategoryResponse(updated);
	}

	async mergeCategories(actorId: string, id: number, b: Static<typeof MergeCategoriesInput>) {
		const source = await this.store.findCategoryById(id);
		if (!source) throw notFound('Category not found');
		if (b.targetId === id) {
			throw badRequest('CANNOT_MERGE_INTO_SELF', 'A category cannot be merged into itself');
		}
		const target = await this.store.findCategoryById(b.targetId);
		if (!target) throw notFound('Target category not found');
		if (source.retiredAt !== null) {
			throw badRequest('CATEGORY_ALREADY_RETIRED', 'Category is already retired');
		}
		if (target.retiredAt !== null) {
			throw badRequest('CANNOT_MERGE_INTO_RETIRED', 'Cannot merge into a retired category');
		}
		const requestsMoved = await this.store.reassignRequests(id, target.id);
		const sourceCaps = await this.store.listCapabilitiesInCategory(id);
		const targetCaps = await this.store.listCapabilitiesInCategory(target.id);
		const targetKeys = new Set(targetCaps.map((c) => `${c.userId}::${c.skillId ?? ''}`));
		let capabilitiesMoved = 0;
		let capabilitiesPruned = 0;
		for (const cap of sourceCaps) {
			const key = `${cap.userId}::${cap.skillId ?? ''}`;
			if (targetKeys.has(key)) {
				await this.store.deleteCapability(cap.id);
				capabilitiesPruned += 1;
			} else {
				await this.store.reassignCapability(cap.id, target.id);
				targetKeys.add(key);
				capabilitiesMoved += 1;
			}
		}
		const now = new Date();
		const updated = await this.store.updateCategory(id, {
			retiredAt: now,
			mergedIntoId: target.id,
		});
		if (!updated) throw notFound('Category not found');
		await this.store.writeAudit({
			actorId,
			action: 'category.merge',
			entityType: 'category',
			before: { id: source.id, name: source.name, retiredAt: null, mergedIntoId: null },
			after: {
				id: updated.id,
				targetId: target.id,
				retiredAt: now.toISOString(),
				mergedIntoId: target.id,
				requestsMoved,
				capabilitiesMoved,
				capabilitiesPruned,
			},
		});
		return toAdminCategoryResponse(updated);
	}

	async addRelatedCategory(actorId: string, id: number, b: Static<typeof RelatedCategoryInput>) {
		const category = await this.store.findCategoryById(id);
		if (!category) throw notFound('Category not found');
		if (b.relatedId === id) {
			throw badRequest('CANNOT_RELATE_TO_SELF', 'A category cannot be related to itself');
		}
		const related = await this.store.findCategoryById(b.relatedId);
		if (!related) throw notFound('Related category not found');
		const existing = await this.store.findRelationBetween(id, b.relatedId);
		if (existing) {
			throw conflict('RELATION_EXISTS', 'These categories are already related');
		}
		const row = await this.store.insertRelation(id, b.relatedId);
		await this.store.writeAudit({
			actorId,
			action: 'category.relate',
			entityType: 'category_relation',
			after: { id: row.id, categoryId: row.categoryId, relatedCategoryId: row.relatedCategoryId },
		});
		return toRelationResponse(row);
	}

	async createSkill(actorId: string, categoryId: number, b: CreateSkillInputType) {
		const category = await this.store.findCategoryById(categoryId);
		if (!category) throw notFound('Category not found');
		const existing = await this.store.findActiveSkillsInCategory(categoryId);
		if (existing.some((s) => sameName(s.name, b.name))) {
			throw conflict('SKILL_NAME_TAKEN', 'An active skill with this name already exists');
		}
		const slug = await this.uniqueSkillSlug(`${category.slug}-${slugify(b.name)}`);
		const row = await this.store.insertSkill({ categoryId, name: b.name, slug });
		await this.store.writeAudit({
			actorId,
			action: 'skill.create',
			entityType: 'skill',
			after: { id: row.id, categoryId, name: row.name, slug },
		});
		return toAdminSkillResponse(row);
	}

	async updateSkill(actorId: string, id: number, b: UpdateSkillInputType) {
		const row = await this.store.findSkillById(id);
		if (!row) throw notFound('Skill not found');
		if (b.name !== undefined) {
			const name = b.name;
			const siblings = await this.store.findActiveSkillsInCategory(row.categoryId);
			if (siblings.some((s) => s.id !== id && sameName(s.name, name))) {
				throw conflict('SKILL_NAME_TAKEN', 'An active skill with this name already exists');
			}
		}
		if (b.retiredAt !== undefined && b.retiredAt !== null && row.retiredAt !== null) {
			throw badRequest('SKILL_ALREADY_RETIRED', 'Skill is already retired');
		}
		const patch: { name?: string; retiredAt?: Date | null } = {};
		if (b.name !== undefined) patch.name = b.name;
		if (b.retiredAt !== undefined) {
			patch.retiredAt = b.retiredAt === null ? null : new Date(b.retiredAt);
		}
		const before = { id: row.id, name: row.name, retiredAt: row.retiredAt?.toISOString() ?? null };
		const updated = await this.store.updateSkill(id, patch);
		if (!updated) throw notFound('Skill not found');
		await this.store.writeAudit({
			actorId,
			action: b.retiredAt !== undefined && b.retiredAt !== null ? 'skill.retire' : 'skill.update',
			entityType: 'skill',
			before,
			after: {
				id: updated.id,
				name: updated.name,
				retiredAt: updated.retiredAt?.toISOString() ?? null,
			},
		});
		return toAdminSkillResponse(updated);
	}
}

export function createCategoryAdminService(store: CategoryAdminStore): CategoryAdminService {
	return new CategoryAdminService(store);
}
