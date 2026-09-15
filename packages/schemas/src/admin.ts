import { type Static, Type } from '@sinclair/typebox';

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
