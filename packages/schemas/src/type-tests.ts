import type { Static } from '@sinclair/typebox';
import type { Category, Skill } from './category';
import type { Profile } from './profile';
import type { UserPrivate, UserPublic } from './user';

type Expect<T extends true> = T;
type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type HasKey<T, K extends string> = K extends keyof T ? true : false;
type NotHasKey<T, K extends string> = K extends keyof T ? false : true;

export type AssertUserPublicHasNoEmail = Expect<NotHasKey<Static<typeof UserPublic>, 'email'>>;
export type AssertUserPublicHasNoPhone = Expect<NotHasKey<Static<typeof UserPublic>, 'phone'>>;
export type AssertProfileHasNoEmail = Expect<NotHasKey<Static<typeof Profile>, 'email'>>;
export type AssertProfileHasNoPhone = Expect<NotHasKey<Static<typeof Profile>, 'phone'>>;

export type AssertUserPrivateHasEmail = Expect<HasKey<Static<typeof UserPrivate>, 'email'>>;
export type AssertUserPrivateHasPhone = Expect<HasKey<Static<typeof UserPrivate>, 'phone'>>;

export type AssertCategoryRetiredAtIsNullable = Expect<
	Equal<Static<typeof Category>['retiredAt'], string | null>
>;
export type AssertSkillRetiredAtIsNullable = Expect<
	Equal<Static<typeof Skill>['retiredAt'], string | null>
>;
