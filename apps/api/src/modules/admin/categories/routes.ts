import { jwt } from '@elysiajs/jwt';
import {
	AdminCategory,
	CategoryDetail,
	CategoryList,
	CategoryRelation,
	CreateCategoryInput,
	CreateSkillInput,
	MergeCategoriesInput,
	RelatedCategoryInput,
	Skill as SkillSchema,
	UpdateCategoryInput,
	UpdateSkillInput,
} from '@together/schemas';
import { Elysia, t } from 'elysia';
import { HttpError } from '../../../lib/errors';
import type { UserRow } from '../../auth/store';
import { requireAdmin } from '../routes';
import type { CategoryAdminService } from './services';

export interface CategoryAdminRouteAuth {
	findUserById(id: string): Promise<UserRow | undefined>;
	jwtSecret: string;
}

function categoryId(params: { id: string }): number {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) {
		throw new HttpError(400, 'VALIDATION', { id: 'invalid' }, undefined, 'Invalid category id');
	}
	return id;
}

function skillId(params: { id: string }): number {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id < 1) {
		throw new HttpError(400, 'VALIDATION', { id: 'invalid' }, undefined, 'Invalid skill id');
	}
	return id;
}

const IdParams = t.Object({ id: t.String() });

export function createCategoryAdminRouter(
	categoryAdmin: CategoryAdminService,
	auth: CategoryAdminRouteAuth,
) {
	const adminGuard = new Elysia({ name: 'admin.categories.guard' })
		.use(jwt({ name: 'jwt', secret: auth.jwtSecret, exp: '15m' }))
		.derive(async ({ headers, jwt: verifier }) => ({
			admin: await requireAdmin(headers as { authorization?: string }, verifier as never, {
				findUserById: auth.findUserById,
			}),
		}))
		.as('scoped');

	return new Elysia()
		.use(adminGuard)
		.get(
			'/admin/categories',
			async () => {
				return categoryAdmin.listCategories();
			},
			{ response: { 200: CategoryList } },
		)
		.post(
			'/admin/categories',
			async ({ body, admin, set }) => {
				const created = await categoryAdmin.createCategory(admin.id, body);
				set.status = 201;
				return created;
			},
			{ body: CreateCategoryInput, response: { 201: AdminCategory } },
		)
		.get(
			'/admin/categories/:id',
			async ({ params }) => {
				return categoryAdmin.getCategoryDetail(categoryId(params));
			},
			{ params: IdParams, response: { 200: CategoryDetail } },
		)
		.patch(
			'/admin/categories/:id',
			async ({ params, body, admin }) => {
				return categoryAdmin.updateCategory(admin.id, categoryId(params), body);
			},
			{ params: IdParams, body: UpdateCategoryInput, response: { 200: AdminCategory } },
		)
		.post(
			'/admin/categories/:id/merge',
			async ({ params, body, admin }) => {
				return categoryAdmin.mergeCategories(admin.id, categoryId(params), body);
			},
			{ params: IdParams, body: MergeCategoriesInput, response: { 200: AdminCategory } },
		)
		.post(
			'/admin/categories/:id/related',
			async ({ params, body, admin, set }) => {
				const relation = await categoryAdmin.addRelatedCategory(admin.id, categoryId(params), body);
				set.status = 201;
				return relation;
			},
			{ params: IdParams, body: RelatedCategoryInput, response: { 201: CategoryRelation } },
		)
		.post(
			'/admin/categories/:id/skills',
			async ({ params, body, admin, set }) => {
				const skill = await categoryAdmin.createSkill(admin.id, categoryId(params), body);
				set.status = 201;
				return skill;
			},
			{ params: IdParams, body: CreateSkillInput, response: { 201: SkillSchema } },
		)
		.patch(
			'/admin/skills/:id',
			async ({ params, body, admin }) => {
				return categoryAdmin.updateSkill(admin.id, skillId(params), body);
			},
			{ params: IdParams, body: UpdateSkillInput, response: { 200: SkillSchema } },
		);
}
