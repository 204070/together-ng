import type { UserPrivateType } from '@together/schemas';
import type { UserRow } from './store';

export function toUserPrivate(user: UserRow): UserPrivateType {
	return {
		id: user.id,
		status: user.status as UserPrivateType['status'],
		createdAt: user.createdAt.toISOString(),
		updatedAt: user.updatedAt.toISOString(),
		email: user.email,
		emailVerified: user.emailVerified,
		phone: user.phone,
		phoneVerified: user.phoneVerified,
		lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
		deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
	};
}
