import { and, type Db, eq, isNull, sql } from '../../infra/database';
import { notifications } from '../../infra/database/schema';

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

function toRow(row: typeof notifications.$inferSelect): NotificationRow {
	return {
		id: row.id,
		user_id: row.userId,
		request_id: row.requestId,
		type: row.type,
		title: row.title,
		body: row.body,
		data: row.data,
		read_at: row.readAt,
		created_at: row.createdAt,
	};
}

export class NotificationStore {
	constructor(private readonly db: Db) {}

	async findByUserId(userId: string): Promise<NotificationRow[]> {
		const rows = await this.db
			.select()
			.from(notifications)
			.where(eq(notifications.userId, userId))
			.orderBy(notifications.createdAt);
		return rows.map(toRow);
	}

	async countUnread(userId: string): Promise<number> {
		const rows = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(notifications)
			.where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
		return rows[0]?.count ?? 0;
	}

	async findByIdAndUser(id: string, userId: string): Promise<NotificationRow | undefined> {
		const rows = await this.db
			.select()
			.from(notifications)
			.where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
		return rows[0] ? toRow(rows[0]) : undefined;
	}

	async markRead(id: string, userId: string): Promise<NotificationRow | undefined> {
		const rows = await this.db
			.update(notifications)
			.set({ readAt: new Date() })
			.where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
			.returning();
		return rows[0] ? toRow(rows[0]) : undefined;
	}

	async markUnread(id: string, userId: string): Promise<NotificationRow | undefined> {
		const rows = await this.db
			.update(notifications)
			.set({ readAt: null })
			.where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
			.returning();
		return rows[0] ? toRow(rows[0]) : undefined;
	}

	async markAllRead(userId: string): Promise<void> {
		await this.db
			.update(notifications)
			.set({ readAt: new Date() })
			.where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
	}

	async create(entry: {
		userId: string;
		requestId?: string | null;
		type: string;
		title: string;
		body?: string | null;
		data?: Record<string, unknown> | null;
	}): Promise<NotificationRow | undefined> {
		const [row] = await this.db
			.insert(notifications)
			.values({
				userId: entry.userId,
				requestId: entry.requestId ?? null,
				type: entry.type as typeof notifications.$inferInsert.type,
				title: entry.title,
				body: entry.body ?? null,
				data: entry.data ?? null,
				createdAt: new Date(),
			})
			.onConflictDoNothing({
				target: [notifications.requestId, notifications.userId],
			})
			.returning();
		return row ? toRow(row) : undefined;
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
