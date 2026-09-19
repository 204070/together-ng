import { type Static, Type } from '@sinclair/typebox';
import { Category, Skill } from './category';

export const AdminMe = Type.Object({
	id: Type.String(),
	email: Type.String(),
	isAdmin: Type.Boolean(),
});
export type AdminMeType = Static<typeof AdminMe>;

export const AdminReports = Type.Object({
	reports: Type.Array(Type.Unknown()),
	total: Type.Integer(),
});
export type AdminReportsType = Static<typeof AdminReports>;

const categoryName = Type.String({ minLength: 1, maxLength: 100, pattern: '\\S' });
const skillName = Type.String({ minLength: 1, maxLength: 100, pattern: '\\S' });
const nullableDateTime = Type.Union([Type.String({ format: 'date-time' }), Type.Null()]);
const nullableInt = Type.Union([Type.Integer(), Type.Null()]);

export const CategoryWithCounts = Type.Object({
	id: Type.Integer(),
	name: Type.String(),
	slug: Type.String(),
	description: Type.Union([Type.String(), Type.Null()]),
	parentId: nullableInt,
	mergedIntoId: nullableInt,
	retiredAt: nullableDateTime,
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
	subcategoryCount: Type.Integer(),
	skillCount: Type.Integer(),
});
export type CategoryWithCountsType = Static<typeof CategoryWithCounts>;

export const CategoryList = Type.Array(CategoryWithCounts);

export const AdminCategory = Type.Object({
	id: Type.Integer(),
	name: Type.String(),
	slug: Type.String(),
	description: Type.Union([Type.String(), Type.Null()]),
	parentId: nullableInt,
	mergedIntoId: nullableInt,
	retiredAt: nullableDateTime,
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
});
export type AdminCategoryType = Static<typeof AdminCategory>;

export const CreateCategoryInput = Type.Object(
	{
		name: categoryName,
		description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
		parentId: Type.Optional(nullableInt),
	},
	{ additionalProperties: false },
);
export type CreateCategoryInputType = Static<typeof CreateCategoryInput>;

export const UpdateCategoryInput = Type.Object(
	{
		name: Type.Optional(categoryName),
		description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
		retiredAt: Type.Optional(nullableDateTime),
	},
	{ additionalProperties: false },
);
export type UpdateCategoryInputType = Static<typeof UpdateCategoryInput>;

export const CreateSkillInput = Type.Object({ name: skillName }, { additionalProperties: false });
export type CreateSkillInputType = Static<typeof CreateSkillInput>;

export const UpdateSkillInput = Type.Object(
	{
		name: Type.Optional(skillName),
		retiredAt: Type.Optional(nullableDateTime),
	},
	{ additionalProperties: false },
);
export type UpdateSkillInputType = Static<typeof UpdateSkillInput>;

export const MergeCategoriesInput = Type.Object(
	{ targetId: Type.Integer() },
	{ additionalProperties: false },
);
export type MergeCategoriesInputType = Static<typeof MergeCategoriesInput>;

export const RelatedCategoryInput = Type.Object(
	{ relatedId: Type.Integer() },
	{ additionalProperties: false },
);
export type RelatedCategoryInputType = Static<typeof RelatedCategoryInput>;

export const CategoryRelation = Type.Object({
	id: Type.String({ format: 'uuid' }),
	categoryId: Type.Integer(),
	relatedCategoryId: Type.Integer(),
	createdAt: Type.String({ format: 'date-time' }),
});
export type CategoryRelationType = Static<typeof CategoryRelation>;

export const CategoryDetail = Type.Object({
	...Category.properties,
	mergedIntoId: nullableInt,
	subcategories: Type.Array(CategoryWithCounts),
	skills: Type.Array(Skill),
	relatedCategories: Type.Array(Category),
});
export type CategoryDetailType = Static<typeof CategoryDetail>;
