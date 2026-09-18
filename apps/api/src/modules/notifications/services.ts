import { type NotificationRow, type NotificationStore, toNotificationResponse } from './store';

export interface SendNotificationInput {
	userId: string;
	requestId?: string | null;
	type: string;
	title: string;
	body: string;
	data?: Record<string, unknown>;
}

export class NotificationService {
	constructor(public readonly store: NotificationStore) {}

	async send(entry: SendNotificationInput): Promise<NotificationRow | undefined> {
		return this.store.create(entry);
	}

	async listForUser(userId: string) {
		const rows = await this.store.findByUserId(userId);
		const unreadCount = await this.store.countUnread(userId);
		return {
			notifications: rows.map(toNotificationResponse),
			unreadCount,
		};
	}

	async markRead(id: string, userId: string) {
		return this.store.markRead(id, userId);
	}

	async markUnread(id: string, userId: string) {
		return this.store.markUnread(id, userId);
	}

	async markAllRead(userId: string) {
		return this.store.markAllRead(userId);
	}

	async getByIdAndUser(id: string, userId: string) {
		return this.store.findByIdAndUser(id, userId);
	}
}

export function createNotificationService(store: NotificationStore): NotificationService {
	return new NotificationService(store);
}

export const createNotificationServices = createNotificationService;
