import { beforeEach, describe, expect, test } from 'bun:test';
import { eq, getDatabase } from '../../../infra/database';
import {
	auditLog,
	categories,
	contributorCapabilities,
	requests,
	skills,
} from '../../../infra/database/schema';
import {
	addCapability,
	adminAuth,
	createCategory,
	createRequest,
	createSkill,
	createUser,
	makeTestApp,
	userAuth,
} from '../../../testing/helpers';

let app: ReturnType<typeof makeTestApp>;

beforeEach(() => {
	app = makeTestApp();
});

async function call(
	method: string,
	path: string,
	token?: string,
	body?: unknown,
): Promise<Response> {
	const headers: Record<string, string> = {};
	if (token !== undefined) headers.authorization = `Bearer ${token}`;
	const init: RequestInit = { method, headers };
	if (body !== undefined) {
		headers['content-type'] = 'application/json';
		init.body = JSON.stringify(body);
	}
	return app.handle(new Request(`http://localhost${path}`, init));
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous JSON response bodies
async function readBody(res: Response): Promise<any> {
	return res.json();
}

const nowIso = () => new Date().toISOString();

describe('admin category auth boundary', () => {
	test('unauthenticated POST returns 401', async () => {
		const res = await call('POST', '/admin/categories', undefined, { name: 'Nope' });
		expect(res.status).toBe(401);
	});

	test('valid non-admin token returns 403 on every admin category route', async () => {
		const { token } = await userAuth({ email: 'user20a@x.com' });
		const cat = await createCategory();
		const skill = await createSkill(cat.id);
		const paths: Array<[string, unknown?]> = [
			['GET', undefined],
			['POST', { name: 'Nope' }],
			[`GET:/admin/categories/${cat.id}`, undefined],
			[`PATCH:/admin/categories/${cat.id}`, { name: 'New' }],
			[`POST:/admin/categories/${cat.id}/merge`, { targetId: cat.id }],
			[`POST:/admin/categories/${cat.id}/related`, { relatedId: cat.id }],
			[`POST:/admin/categories/${cat.id}/skills`, { name: 'S' }],
			[`PATCH:/admin/skills/${skill.id}`, { name: 'S2' }],
		];
		for (const [spec, body] of paths) {
			const [method, path] = spec.split(':') as [string, string?];
			const res = await call(method, (path ?? '/admin/categories') as string, token, body);
			expect(`${method} ${(path ?? '/admin/categories') as string} → ${res.status}`).toBe(
				`${method} ${(path ?? '/admin/categories') as string} → 403`,
			);
			expect((await readBody(res)).error).toBe('ADMIN_ACCESS_REQUIRED');
		}
	});
});

describe('POST /admin/categories', () => {
	test('admin creates a top-level category: 201, visible in admin list and public GET /categories', async () => {
		const { token } = await adminAuth({ email: 'admin20b@x.com' });
		const res = await call('POST', '/admin/categories', token, { name: 'Gardening' });
		expect(res.status).toBe(201);
		const created = await readBody(res);
		expect(created.name).toBe('Gardening');
		expect(created.slug).toBe('gardening');
		expect(typeof created.id).toBe('number');

		const list = await readBody(await call('GET', '/admin/categories', token));
		expect(list.some((c: { name: string }) => c.name === 'Gardening')).toBe(true);

		const pub = await readBody(await call('GET', '/categories'));
		expect(pub.some((c: { name: string }) => c.name === 'Gardening')).toBe(true);

		const audits = await getDatabase().select().from(auditLog);
		expect(audits.some((a) => a.action === 'category.create')).toBe(true);
	});

	test('duplicate active name returns 409', async () => {
		const { token } = await adminAuth({ email: 'admin20c@x.com' });
		expect((await call('POST', '/admin/categories', token, { name: 'Pottery' })).status).toBe(201);
		const dup = await call('POST', '/admin/categories', token, { name: 'pottery' });
		expect(dup.status).toBe(409);
		expect((await readBody(dup)).error).toBe('CATEGORY_NAME_TAKEN');
	});

	test('retired name can be reused by a new active category', async () => {
		const { token } = await adminAuth({ email: 'admin20d@x.com' });
		const created = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Weaving' }),
		);
		const retired = await call('PATCH', `/admin/categories/${created.id}`, token, {
			retiredAt: nowIso(),
		});
		expect(retired.status).toBe(200);
		const reuse = await call('POST', '/admin/categories', token, { name: 'Weaving' });
		expect(reuse.status).toBe(201);
	});

	test('empty name and over-long name return 400', async () => {
		const { token } = await adminAuth({ email: 'admin20e@x.com' });
		expect((await call('POST', '/admin/categories', token, { name: '' })).status).toBe(400);
		expect((await call('POST', '/admin/categories', token, { name: 'x'.repeat(101) })).status).toBe(
			400,
		);
		expect((await call('POST', '/admin/categories', token, { name: '   ' })).status).toBe(400);
	});

	test('unknown parent returns 404', async () => {
		const { token } = await adminAuth({ email: 'admin20f@x.com' });
		const res = await call('POST', '/admin/categories', token, {
			name: 'Orphan',
			parentId: 999999,
		});
		expect(res.status).toBe(404);
	});
});

describe('PATCH /admin/categories/:id (rename + retire)', () => {
	test('rename keeps the same integer id and is visible in GET /categories', async () => {
		const { token } = await adminAuth({ email: 'admin20g@x.com' });
		const created = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Old Name' }),
		);
		const res = await call('PATCH', `/admin/categories/${created.id}`, token, {
			name: 'New Name',
		});
		expect(res.status).toBe(200);
		const renamed = await readBody(res);
		expect(renamed.id).toBe(created.id);
		expect(renamed.name).toBe('New Name');
		expect(renamed.slug).toBe(created.slug);

		const [row] = await getDatabase()
			.select()
			.from(categories)
			.where(eq(categories.id, created.id));
		expect(row?.id).toBe(created.id);
		expect(row?.name).toBe('New Name');

		const pub = await readBody(await call('GET', '/categories'));
		expect(
			pub.some((c: { id: number; name: string }) => c.id === created.id && c.name === 'New Name'),
		).toBe(true);
	});

	test('rename to a duplicate active sibling name returns 409', async () => {
		const { token } = await adminAuth({ email: 'admin20h@x.com' });
		const a = await readBody(await call('POST', '/admin/categories', token, { name: 'Alpha' }));
		const b = await readBody(await call('POST', '/admin/categories', token, { name: 'Beta' }));
		expect(a.id).not.toBe(b.id);
		const res = await call('PATCH', `/admin/categories/${b.id}`, token, { name: 'alpha' });
		expect(res.status).toBe(409);
	});

	test('retire hides from picker and ?active=true but keeps ?includeRetired and direct request reads', async () => {
		const { token, user } = await adminAuth({ email: 'admin20i@x.com' });
		const created = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Fading' }),
		);
		const requestId = await createRequest(user.id, { categoryId: created.id });

		const res = await call('PATCH', `/admin/categories/${created.id}`, token, {
			retiredAt: nowIso(),
		});
		expect(res.status).toBe(200);
		expect(await readBody(res)).toMatchObject({ id: created.id });

		const [row] = await getDatabase()
			.select()
			.from(categories)
			.where(eq(categories.id, created.id));
		expect(row?.retiredAt).not.toBeNull();

		const activeOnly = await readBody(await call('GET', '/categories?active=true'));
		expect(activeOnly.some((c: { id: number }) => c.id === created.id)).toBe(false);
		const plain = await readBody(await call('GET', '/categories'));
		expect(plain.some((c: { id: number }) => c.id === created.id)).toBe(false);
		const withRetired = await readBody(await call('GET', '/categories?includeRetired=true'));
		expect(withRetired.some((c: { id: number }) => c.id === created.id)).toBe(true);

		const direct = await call('GET', `/requests/${requestId}`, token);
		expect(direct.status).toBe(200);
	});

	test('retiring an already-retired category returns 400', async () => {
		const { token } = await adminAuth({ email: 'admin20j@x.com' });
		const created = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Twice' }),
		);
		expect(
			(await call('PATCH', `/admin/categories/${created.id}`, token, { retiredAt: nowIso() }))
				.status,
		).toBe(200);
		const again = await call('PATCH', `/admin/categories/${created.id}`, token, {
			retiredAt: nowIso(),
		});
		expect(again.status).toBe(400);
		expect((await readBody(again)).error).toBe('CATEGORY_ALREADY_RETIRED');
	});
});

describe('subcategories', () => {
	test('POST with parentId sets parent_id and appears in ?parentId filter with counts', async () => {
		const { token } = await adminAuth({ email: 'admin20k@x.com' });
		const parent = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Parent Cat' }),
		);
		const child = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Child Cat', parentId: parent.id }),
		);
		expect(child.parentId).toBe(parent.id);

		const [row] = await getDatabase().select().from(categories).where(eq(categories.id, child.id));
		expect(row?.parentId).toBe(parent.id);

		const filtered = await readBody(await call('GET', `/categories?parentId=${parent.id}`));
		expect(filtered.some((c: { id: number }) => c.id === child.id)).toBe(true);

		const list = await readBody(await call('GET', '/admin/categories', token));
		const parentRow = list.find((c: { id: number }) => c.id === parent.id);
		expect(parentRow.subcategoryCount).toBe(1);

		const detail = await readBody(await call('GET', `/admin/categories/${parent.id}`, token));
		expect(detail.subcategories.some((c: { id: number }) => c.id === child.id)).toBe(true);
	});
});

describe('skills', () => {
	test('POST skill appears in detail view and public skills list with counts', async () => {
		const { token } = await adminAuth({ email: 'admin20l@x.com' });
		const cat = await readBody(await call('POST', '/admin/categories', token, { name: 'Crafts' }));
		const res = await call('POST', `/admin/categories/${cat.id}/skills`, token, {
			name: 'Wood Carving',
		});
		expect(res.status).toBe(201);
		const skill = await readBody(res);
		expect(skill.categoryId).toBe(cat.id);

		const detail = await readBody(await call('GET', `/admin/categories/${cat.id}`, token));
		expect(detail.skills.some((s: { id: number }) => s.id === skill.id)).toBe(true);

		const pubSkills = await readBody(await call('GET', `/categories/${cat.id}/skills`));
		expect(pubSkills.some((s: { id: number }) => s.id === skill.id)).toBe(true);

		const list = await readBody(await call('GET', '/admin/categories', token));
		expect(list.find((c: { id: number }) => c.id === cat.id).skillCount).toBe(1);
	});

	test('duplicate active skill name in the same category returns 409', async () => {
		const { token } = await adminAuth({ email: 'admin20m@x.com' });
		const cat = await readBody(await call('POST', '/admin/categories', token, { name: 'Music' }));
		expect(
			(await call('POST', `/admin/categories/${cat.id}/skills`, token, { name: 'Drums' })).status,
		).toBe(201);
		const dup = await call('POST', `/admin/categories/${cat.id}/skills`, token, {
			name: 'drums',
		});
		expect(dup.status).toBe(409);
		expect((await readBody(dup)).error).toBe('SKILL_NAME_TAKEN');
	});

	test('retiring a skill keeps the row but hides it from the picker', async () => {
		const { token } = await adminAuth({ email: 'admin20n@x.com' });
		const cat = await readBody(await call('POST', '/admin/categories', token, { name: 'Sports' }));
		const skill = await readBody(
			await call('POST', `/admin/categories/${cat.id}/skills`, token, { name: 'Archery' }),
		);
		const res = await call('PATCH', `/admin/skills/${skill.id}`, token, {
			retiredAt: nowIso(),
		});
		expect(res.status).toBe(200);

		const [row] = await getDatabase().select().from(skills).where(eq(skills.id, skill.id));
		expect(row).toBeDefined();
		expect(row?.retiredAt).not.toBeNull();

		const pubSkills = await readBody(await call('GET', `/categories/${cat.id}/skills`));
		expect(pubSkills.some((s: { id: number }) => s.id === skill.id)).toBe(false);

		const again = await call('PATCH', `/admin/skills/${skill.id}`, token, {
			retiredAt: nowIso(),
		});
		expect(again.status).toBe(400);
	});
});

describe('POST /admin/categories/:id/merge', () => {
	test('merge reassigns requests + capabilities, retires source with mergedInto, keeps history', async () => {
		const { token } = await adminAuth({ email: 'admin20o@x.com' });
		const source = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Source Cat' }),
		);
		const target = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Target Cat' }),
		);
		const author = await createUser('author20o@x.com');
		const helper = await createUser('helper20o@x.com');
		const requestId = await createRequest(author.id, { categoryId: source.id });
		await addCapability({ userId: helper.id, categoryId: source.id });

		const res = await call('POST', `/admin/categories/${source.id}/merge`, token, {
			targetId: target.id,
		});
		expect(res.status).toBe(200);
		const merged = await readBody(res);
		expect(merged.id).toBe(source.id);
		expect(merged.mergedIntoId).toBe(target.id);
		expect(merged.retiredAt).not.toBeNull();

		const leftover = await getDatabase()
			.select()
			.from(requests)
			.where(eq(requests.categoryId, source.id));
		expect(leftover).toHaveLength(0);
		const moved = await getDatabase()
			.select()
			.from(requests)
			.where(eq(requests.categoryId, target.id));
		expect(moved.some((r) => r.id === requestId)).toBe(true);

		const caps = await getDatabase()
			.select()
			.from(contributorCapabilities)
			.where(eq(contributorCapabilities.categoryId, target.id));
		expect(caps.some((c) => c.userId === helper.id)).toBe(true);

		const [sourceRow] = await getDatabase()
			.select()
			.from(categories)
			.where(eq(categories.id, source.id));
		expect(sourceRow?.retiredAt).not.toBeNull();

		const audits = await getDatabase().select().from(auditLog);
		expect(audits.some((a) => a.action === 'category.merge')).toBe(true);
	});

	test('merge dedupes conflicting capabilities instead of failing', async () => {
		const { token } = await adminAuth({ email: 'admin20p@x.com' });
		const source = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Dup Source' }),
		);
		const target = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Dup Target' }),
		);
		const helper = await createUser('helper20p@x.com');
		await addCapability({ userId: helper.id, categoryId: source.id });
		await addCapability({ userId: helper.id, categoryId: target.id });

		const res = await call('POST', `/admin/categories/${source.id}/merge`, token, {
			targetId: target.id,
		});
		expect(res.status).toBe(200);
		const caps = await getDatabase()
			.select()
			.from(contributorCapabilities)
			.where(eq(contributorCapabilities.categoryId, target.id));
		expect(caps.filter((c) => c.userId === helper.id)).toHaveLength(1);
	});

	test('merging into self returns 400; unknown target returns 404', async () => {
		const { token } = await adminAuth({ email: 'admin20q@x.com' });
		const source = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Selfish' }),
		);
		const self = await call('POST', `/admin/categories/${source.id}/merge`, token, {
			targetId: source.id,
		});
		expect(self.status).toBe(400);
		expect((await readBody(self)).error).toBe('CANNOT_MERGE_INTO_SELF');

		const missing = await call('POST', `/admin/categories/${source.id}/merge`, token, {
			targetId: 999999,
		});
		expect(missing.status).toBe(404);
	});
});

describe('POST /admin/categories/:id/related', () => {
	test('related link shows on both category details and rejects duplicates/self', async () => {
		const { token } = await adminAuth({ email: 'admin20r@x.com' });
		const a = await readBody(await call('POST', '/admin/categories', token, { name: 'Baking' }));
		const b = await readBody(await call('POST', '/admin/categories', token, { name: 'Cooking' }));

		const res = await call('POST', `/admin/categories/${a.id}/related`, token, {
			relatedId: b.id,
		});
		expect(res.status).toBe(201);

		const detailA = await readBody(await call('GET', `/admin/categories/${a.id}`, token));
		const detailB = await readBody(await call('GET', `/admin/categories/${b.id}`, token));
		expect(detailA.relatedCategories.some((c: { id: number }) => c.id === b.id)).toBe(true);
		expect(detailB.relatedCategories.some((c: { id: number }) => c.id === a.id)).toBe(true);

		const dup = await call('POST', `/admin/categories/${a.id}/related`, token, {
			relatedId: b.id,
		});
		expect(dup.status).toBe(409);

		const self = await call('POST', `/admin/categories/${a.id}/related`, token, {
			relatedId: a.id,
		});
		expect(self.status).toBe(400);
	});
});

describe('admin list shape', () => {
	test('GET /admin/categories carries name, slug, status, subcategory and skill counts', async () => {
		const { token } = await adminAuth({ email: 'admin20s@x.com' });
		const parent = await readBody(
			await call('POST', '/admin/categories', token, { name: 'Top Level' }),
		);
		await call('POST', '/admin/categories', token, { name: 'Nested One', parentId: parent.id });
		await call('POST', `/admin/categories/${parent.id}/skills`, token, { name: 'Top Skill' });

		const res = await call('GET', '/admin/categories', token);
		expect(res.status).toBe(200);
		const list = await readBody(res);
		const row = list.find((c: { id: number }) => c.id === parent.id);
		expect(row.name).toBe('Top Level');
		expect(row.slug).toBe('top-level');
		expect(row.retiredAt).toBeNull();
		expect(row.subcategoryCount).toBe(1);
		expect(row.skillCount).toBe(1);
	});
});
