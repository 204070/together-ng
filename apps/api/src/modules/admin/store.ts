import { and, count, type Db, desc, eq, inArray } from '../../infra/database';
import {
	auditLog,
	contributions,
	lendingAgreements,
	moderationActions,
	profiles,
	reports,
	requests,
	resources,
	users,
} from '../../infra/database/schema';

export type ReportRow = typeof reports.$inferSelect;
export type ModerationActionRow = typeof moderationActions.$inferSelect;

export interface ReportListFilters {
	page: number;
	limit: number;
	status?: string;
	category?: string;
}

export interface AuditListFilters {
	page: number;
	limit: number;
	actorId?: string;
	entityType?: string;
	entityId?: string;
	action?: string;
}

/**
 * Report queue persistence. Reads never return `reporterId`: reporter
 * identity is stored for audit but never leaves the server on a wire
 * shape (issue #19, Section 35/50).
 */
export class ReportStore {
	constructor(private readonly db: Db) {}

	async list(filters: ReportListFilters): Promise<{ rows: ReportRow[]; total: number }> {
		const conditions = [];
		if (filters.status !== undefined)
			conditions.push(eq(reports.status, filters.status as ReportRow['status']));
		if (filters.category !== undefined) {
			conditions.push(eq(reports.subjectType, filters.category as ReportRow['subjectType']));
		}
		const where = conditions.length > 0 ? and(...conditions) : undefined;
		const offset = (filters.page - 1) * filters.limit;
		const [rows, totalRows] = await Promise.all([
			this.db
				.select()
				.from(reports)
				.where(where)
				.orderBy(desc(reports.createdAt))
				.limit(filters.limit)
				.offset(offset),
			this.db.select({ total: count() }).from(reports).where(where),
		]);
		return { rows, total: totalRows[0]?.total ?? 0 };
	}

	async findById(id: string): Promise<ReportRow | undefined> {
		const rows = await this.db.select().from(reports).where(eq(reports.id, id)).limit(1);
		return rows[0];
	}

	/**
	 * Transitions a report out of the open states exactly once. Returns the
	 * updated row, or `undefined` when the report does not exist or another
	 * admin already resolved it (the caller maps that to 404 or 409).
	 */
	async resolveIfOpen(
		id: string,
		input: { status: 'resolved' | 'dismissed'; resolvedBy: string; resolvedAt: Date },
	): Promise<ReportRow | undefined> {
		const rows = await this.db
			.update(reports)
			.set({
				status: input.status,
				resolvedBy: input.resolvedBy,
				resolvedAt: input.resolvedAt,
				updatedAt: input.resolvedAt,
			})
			.where(and(eq(reports.id, id), inArray(reports.status, ['pending', 'under_review'])))
			.returning();
		return rows[0];
	}

	/**
	 * Public snapshot of the reported content: only the fields an admin
	 * needs to judge the report. Never includes reporter identity, emails,
	 * or phone numbers. Subject types without a backing table yet
	 * (`message`, `resource_listing` — owned by unmerged issues) resolve
	 * to `null` rather than failing the detail view.
	 */
	async findSubjectSnapshot(subjectType: string, subjectId: string): Promise<unknown> {
		switch (subjectType) {
			case 'request': {
				const rows = await this.db
					.select({
						id: requests.id,
						title: requests.title,
						goal: requests.goal,
						barrier: requests.barrier,
						helpNeeded: requests.helpNeeded,
						state: requests.state,
						authorId: requests.authorId,
					})
					.from(requests)
					.where(eq(requests.id, subjectId))
					.limit(1);
				return rows[0] ?? null;
			}
			case 'profile': {
				const rows = await this.db
					.select({
						id: profiles.id,
						userId: profiles.userId,
						displayName: profiles.displayName,
						bio: profiles.bio,
						location: profiles.location,
					})
					.from(profiles)
					.where(eq(profiles.userId, subjectId))
					.limit(1);
				return rows[0] ?? null;
			}
			case 'contribution': {
				const rows = await this.db
					.select({
						id: contributions.id,
						requestId: contributions.requestId,
						contributorId: contributions.contributorId,
						status: contributions.status,
					})
					.from(contributions)
					.where(eq(contributions.id, subjectId))
					.limit(1);
				return rows[0] ?? null;
			}
			case 'resource': {
				const rows = await this.db
					.select({
						id: resources.id,
						title: resources.title,
						description: resources.description,
						kind: resources.kind,
						status: resources.status,
						ownerId: resources.ownerId,
					})
					.from(resources)
					.where(eq(resources.id, subjectId))
					.limit(1);
				return rows[0] ?? null;
			}
			case 'lending_agreement': {
				const rows = await this.db
					.select({
						id: lendingAgreements.id,
						resourceId: lendingAgreements.resourceId,
						ownerId: lendingAgreements.ownerId,
						borrowerId: lendingAgreements.borrowerId,
						status: lendingAgreements.status,
					})
					.from(lendingAgreements)
					.where(eq(lendingAgreements.id, subjectId))
					.limit(1);
				return rows[0] ?? null;
			}
			default:
				return null;
		}
	}

	/**
	 * Resolves the user a moderation action applies to from the reported
	 * content. Returns `null` when the subject type has no target user
	 * (unbacked subject types) or the referenced row is gone.
	 */
	async findTargetUserId(subjectType: string, subjectId: string): Promise<string | null> {
		switch (subjectType) {
			case 'request': {
				const rows = await this.db
					.select({ authorId: requests.authorId })
					.from(requests)
					.where(eq(requests.id, subjectId))
					.limit(1);
				return rows[0]?.authorId ?? null;
			}
			case 'profile':
				return subjectId;
			case 'contribution': {
				const rows = await this.db
					.select({ contributorId: contributions.contributorId })
					.from(contributions)
					.where(eq(contributions.id, subjectId))
					.limit(1);
				return rows[0]?.contributorId ?? null;
			}
			case 'resource': {
				const rows = await this.db
					.select({ ownerId: resources.ownerId })
					.from(resources)
					.where(eq(resources.id, subjectId))
					.limit(1);
				return rows[0]?.ownerId ?? null;
			}
			case 'lending_agreement': {
				const rows = await this.db
					.select({ borrowerId: lendingAgreements.borrowerId })
					.from(lendingAgreements)
					.where(eq(lendingAgreements.id, subjectId))
					.limit(1);
				return rows[0]?.borrowerId ?? null;
			}
			default:
				return null;
		}
	}
}

/** Moderation actions and the account-status side effects they carry. */
export class ModerationStore {
	constructor(private readonly db: Db) {}

	async insertAction(input: {
		targetUserId: string;
		action: ModerationActionRow['action'];
		severity: ModerationActionRow['severity'];
		reason: string;
		performedBy: string;
		expiresAt: Date | null;
	}): Promise<ModerationActionRow> {
		const rows = await this.db.insert(moderationActions).values(input).returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to insert moderation action');
		return row;
	}

	async setUserStatus(userId: string, status: 'active' | 'suspended'): Promise<void> {
		await this.db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
	}
}

export interface AuditEntry {
	id: number;
	actorId: string | null;
	actorEmail: string | null;
	action: string;
	entityType: string | null;
	entityId: string | null;
	before: unknown;
	after: unknown;
	ipAddress: string | null;
	createdAt: Date;
}

/**
 * Append-only audit log (Section 50). This store exposes `append` and
 * `list` only — there is intentionally no update or delete method, and
 * the routes layer answers 405 to PATCH/DELETE on audit entries.
 */
export class AuditStore {
	constructor(private readonly db: Db) {}

	async append(input: {
		actorId: string | null;
		action: string;
		entityType: string | null;
		entityId: string | null;
		before: unknown;
		after: unknown;
		ipAddress: string | null;
	}): Promise<void> {
		await this.db.insert(auditLog).values(input);
	}

	async list(filters: AuditListFilters): Promise<{ entries: AuditEntry[]; total: number }> {
		const conditions = [];
		if (filters.actorId !== undefined) conditions.push(eq(auditLog.actorId, filters.actorId));
		if (filters.entityType !== undefined)
			conditions.push(eq(auditLog.entityType, filters.entityType));
		if (filters.entityId !== undefined) conditions.push(eq(auditLog.entityId, filters.entityId));
		if (filters.action !== undefined) conditions.push(eq(auditLog.action, filters.action));
		const where = conditions.length > 0 ? and(...conditions) : undefined;
		const offset = (filters.page - 1) * filters.limit;
		const [rows, totalRows] = await Promise.all([
			this.db
				.select({
					id: auditLog.id,
					actorId: auditLog.actorId,
					actorEmail: users.email,
					action: auditLog.action,
					entityType: auditLog.entityType,
					entityId: auditLog.entityId,
					before: auditLog.before,
					after: auditLog.after,
					ipAddress: auditLog.ipAddress,
					createdAt: auditLog.createdAt,
				})
				.from(auditLog)
				.leftJoin(users, eq(auditLog.actorId, users.id))
				.where(where)
				.orderBy(desc(auditLog.createdAt))
				.limit(filters.limit)
				.offset(offset),
			this.db.select({ total: count() }).from(auditLog).where(where),
		]);
		return { entries: rows, total: totalRows[0]?.total ?? 0 };
	}
}
