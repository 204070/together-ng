import {
	type CategoryFilters,
	type TaxonomyStore,
	toCategoryResponse,
	toSkillResponse,
} from './store';

export class TaxonomyService {
	constructor(public readonly store: TaxonomyStore) {}

	async listCategories(filters: CategoryFilters = {}) {
		const rows = await this.store.listCategories(filters);
		return rows.map(toCategoryResponse);
	}

	async listSkills(categoryId: number) {
		const rows = await this.store.listActiveSkills(categoryId);
		return rows.map(toSkillResponse);
	}
}

export function createTaxonomyService(store: TaxonomyStore): TaxonomyService {
	return new TaxonomyService(store);
}
