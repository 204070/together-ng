// @together/schemas — single source of truth TypeBox schemas built from
// Type.Object / Type.Enum, mirroring the shared SQL schema definitions.
export const name = '@together/schemas';

export const schemasVersion = '0.0.0';

export * from './auth';
export * from './category';
export * from './contribution';
export * from './outcome';
export * from './profile';
export * from './request';
export * from './response';
export * from './user';
export * from './validate';
export * from './vote';

export default name;
