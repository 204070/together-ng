import { type Static, Type } from '@sinclair/typebox';
import './formats';

export const Category = Type.Object({
	id: Type.Integer(),
	name: Type.String(),
	slug: Type.String(),
	description: Type.Union([Type.String(), Type.Null()]),
	parentId: Type.Union([Type.Integer(), Type.Null()]),
	retiredAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
});

export const Skill = Type.Object({
	id: Type.Integer(),
	categoryId: Type.Integer(),
	name: Type.String(),
	slug: Type.String(),
	retiredAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
	createdAt: Type.String({ format: 'date-time' }),
	updatedAt: Type.String({ format: 'date-time' }),
});

export type CategoryType = Static<typeof Category>;
export type SkillType = Static<typeof Skill>;
