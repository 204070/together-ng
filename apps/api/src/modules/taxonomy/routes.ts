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
				const rows = await services.sql<{
					id: number;
					name: string;
					slug: string;
					description: string | null;
				}>`SELECT id, name, slug, description FROM categories WHERE retired_at IS NULL ORDER BY name`;
				return rows;
			},
			{
				response: { 200: CategoryList },
			},
		)
		.get(
			'/categories/:id/skills',
			async ({ params }) => {
				const rows = await services.sql<{
					id: number;
					category_id: number;
					name: string;
					slug: string;
				}>`SELECT id, category_id, name, slug FROM skills WHERE category_id = ${params.id} AND retired_at IS NULL ORDER BY name`;
				return rows;
			},
			{
				response: { 200: SkillList },
			},
		);
}
