import { eq, isNull, categories, skills } from '@together/db';
import { Category, Skill, Type } from '@together/schemas';
import { Elysia } from 'elysia';
import type { AuthServices } from '../auth/services';

const CategoryList = Type.Array(Category);
const SkillList = Type.Array(Skill);

export function createTaxonomyRouter(services: AuthServices) {
	return new Elysia()
		.get(
			'/categories',
			async () => {
				const rows = await services.db
					.select()
					.from(categories)
					.where(isNull(categories.retiredAt))
					.orderBy(categories.name);
				return rows.map((r) => ({
					id: r.id,
					name: r.name,
					slug: r.slug,
					description: r.description,
					parentId: r.parentId,
					retiredAt: r.retiredAt ? r.retiredAt.toISOString() : null,
					createdAt: r.createdAt.toISOString(),
					updatedAt: r.updatedAt.toISOString(),
				}));
			},
			{
				response: { 200: CategoryList },
			},
		)
		.get(
			'/categories/:id/skills',
			async ({ params }) => {
				const rows = await services.db
					.select()
					.from(skills)
					.where(eq(skills.categoryId, Number(params.id)) && isNull(skills.retiredAt))
					.orderBy(skills.name);
				return rows.map((r) => ({
					id: r.id,
					categoryId: r.categoryId,
					name: r.name,
					slug: r.slug,
					retiredAt: r.retiredAt ? r.retiredAt.toISOString() : null,
					createdAt: r.createdAt.toISOString(),
					updatedAt: r.updatedAt.toISOString(),
				}));
			},
			{
				response: { 200: SkillList },
			},
		);
}
