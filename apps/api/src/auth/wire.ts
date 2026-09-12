import type { UserPrivateType } from '@together/schemas';
import type { UserRow } from './store';

export function toUserPrivate(user: UserRow): UserPrivateType {
	return {
		id: user.id,
		status: user.status as UserPrivateType['status'],
		createdAt: user.created_at.toISOString(),
		updatedAt: user.updated_at.toISOString(),
		email: user.email,
		emailVerified: user.email_verified,
		phone: user.phone,
		phoneVerified: user.phone_verified,
		lastLoginAt: user.last_login_at ? user.last_login_at.toISOString() : null,
		deletedAt: user.deleted_at ? user.deleted_at.toISOString() : null,
	};
}
