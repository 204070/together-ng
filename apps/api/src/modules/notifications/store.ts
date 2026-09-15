import type { Sql } from '@together/db';

export interface NotificationRow {
	id: string;
	user_id: string;
	request_id: string | null;
	type: string;
	title: string;
	body: string | null;
	data: unknown;
	read_at: Date | null;
	created_at: Date;
}

export class NotificationStore {
	constructor(private readonly sql: Sql) {}

	async findByUserId(userId: string): Promise<NotificationRow[]> {
		return this.sql<NotificationRow[]>`
			SELECT id, user_id, request_id, type, title, body, data, read_at, created_at
			FROM notifications
			WHERE user_id = ${userId}
			ORDER BY created_at DESC
		`;
	}

	async countUnread(userId: string): Promise<number> {
		const rows = await this.sql<{ count: number }[]>`
			SELECT count(*)::int AS count
			FROM notifications
			WHERE user_id = ${userId} AND read_at IS NULL
		`;
		return rows[0]?.count ?? 0;
	}

	async findByIdAndUser(id: string, userId: string): Promise<NotificationRow | undefined> {
		const rows = await this.sql<NotificationRow[]>`
			SELECT id, user_id, request_id, type, title, body, data, read_at, created_at
			FROM notifications
			WHERE id = ${id} AND user_id = ${userId}
		`;
		return rows[0];
	}

	async markRead(id: string, userId: string): Promise<NotificationRow | undefined> {
		const rows = await this.sql<NotificationRow[]>`
			UPDATE notifications
			SET read_at = now()
			WHERE id = ${id} AND user_id = ${userId}
			RETURNING id, user_id, request_id, type, title, body, data, read_at, created_at
		`;
		return rows[0];
	}

	async markUnread(id: string, userId: string): Promise<NotificationRow | undefined> {
		const rows = await this.sql<NotificationRow[]>`
			UPDATE notifications
			SET read_at = NULL
			WHERE id = ${id} AND user_id = ${userId}
			RETURNING id, user_id, request_id, type, title, body, data, read_at, created_at
		`;
		return rows[0];
	}

	async markAllRead(userId: string): Promise<void> {
		await this.sql`
			UPDATE notifications
			SET read_at = now()
			WHERE user_id = ${userId} AND read_at IS NULL
		`;
	}
}

export function toNotificationResponse(row: NotificationRow) {
	return {
		id: row.id,
		userId: row.user_id,
		requestId: row.request_id,
		type: row.type,
		title: row.title,
		body: row.body,
		data: row.data,
		readAt: row.read_at ? row.read_at.toISOString() : null,
		createdAt: row.created_at.toISOString(),
	};
}
