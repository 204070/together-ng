import { Category, Skill, Type } from '@together/schemas';
import { Elysia, t } from 'elysia';
import type { Db } from '../../infra/database';
import { TaxonomyService } from './services';
import { TaxonomyStore } from './store';

const CategoryList = Type.Array(Category);
const SkillList = Type.Array(Skill);

const CategoryQuery = t.Object({
	parentId: t.Optional(t.String()),
	active: t.Optional(t.String()),
	includeRetired: t.Optional(t.String()),
});

function parseParentId(raw: string | undefined): number | null | undefined {
	if (raw === undefined || raw === '') return undefined;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return undefined;
	return n;
}

function parseFlag(raw: string | undefined): boolean | undefined {
	if (raw === undefined || raw === '') return undefined;
	if (raw === 'true' || raw === '1') return true;
	if (raw === 'false' || raw === '0') return false;
	return undefined;
}

export function createTaxonomyRouter(services: { db: Db } | { taxonomyService: TaxonomyService }) {
	const taxonomyService =
		'taxonomyService' in services
			? services.taxonomyService
			: new TaxonomyService(new TaxonomyStore(services.db));
	return new Elysia()
		.get(
			'/categories',
			async ({ query }) => {
				return taxonomyService.listCategories({
					parentId: parseParentId(query.parentId),
					active: parseFlag(query.active) ?? null,
					includeRetired: parseFlag(query.includeRetired) ?? null,
				});
			},
			{
				query: CategoryQuery,
				response: { 200: CategoryList },
			},
		)
		.get(
			'/categories/:id/skills',
			async ({ params }) => {
				return taxonomyService.listSkills(Number(params.id));
			},
			{
				response: { 200: SkillList },
			},
		);
}
