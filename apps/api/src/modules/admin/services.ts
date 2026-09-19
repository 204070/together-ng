import type {
	AuditLogQueryType,
	AuditLogResponseType,
	ReportActionInputType,
	ReportActionResponseType,
	ReportActionValue,
	ReportDetailType,
	ReportsQueryType,
} from '@together/schemas';
import { HttpError } from '../../lib/errors';
import type { AuditEntry, AuditStore, ModerationStore, ReportRow, ReportStore } from './store';

function notFound(message = 'Report not found'): HttpError {
	return new HttpError(404, 'NOT_FOUND', undefined, undefined, message);
}

function alreadyResolved(): HttpError {
	return new HttpError(409, 'ALREADY_RESOLVED', undefined, undefined, 'Already resolved');
}

function targetNotFound(): HttpError {
	return new HttpError(
		422,
		'TARGET_NOT_FOUND',
		undefined,
		undefined,
		'Reported content target not found',
	);
}

const OPEN_STATUSES = new Set(['pending', 'under_review']);

const WIRE_TO_MODERATION_ACTION = {
	warn: 'warning',
	restrict: 'restrict',
	suspend: 'suspend',
	restore: 'restore',
} as const;

const ACTION_SEVERITY = {
	warn: 'low',
	restrict: 'moderate',
	suspend: 'serious',
	restore: 'low',
} as const;

function toIso(date: Date): string {
	return date.toISOString();
}

function toIsoOrNull(date: Date | null): string | null {
	return date?.toISOString() ?? null;
}

/**
 * Report review and moderation workflow (issue #19). Owns the
 * report state machine, the moderation side effects (including account
 * suspend/restore), and the append-only audit trail. HTTP concerns
 * (auth, status codes, validation) stay in `routes.ts`.
 */
export class AdminService {
	constructor(
		private readonly reports: ReportStore,
		private readonly moderation: ModerationStore,
		private readonly audit: AuditStore,
	) {}

	async listReports(query: ReportsQueryType): Promise<{
		reports: Array<{
			id: string;
			reason: string;
			category: ReportRow['subjectType'];
			status: ReportRow['status'];
			createdAt: string;
			subjectId: string;
		}>;
		total: number;
	}> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 25;
		const { rows, total } = await this.reports.list({
			page,
			limit,
			status: query.status,
			category: query.category,
		});
		return {
			reports: rows.map((row) => ({
				id: row.id,
				reason: row.reason,
				category: row.subjectType,
				status: row.status,
				createdAt: toIso(row.createdAt),
				subjectId: row.subjectId,
			})),
			total,
		};
	}

	async getReportDetail(id: string): Promise<ReportDetailType> {
		const row = await this.reports.findById(id);
		if (!row) throw notFound();
		return this.toDetail(row);
	}

	async actOnReport(
		reportId: string,
		adminId: string,
		input: ReportActionInputType,
		ipAddress: string | null,
	): Promise<ReportActionResponseType> {
		const action: ReportActionValue = input.action;
		const report = await this.reports.findById(reportId);
		if (!report) throw notFound();
		if (!OPEN_STATUSES.has(report.status)) throw alreadyResolved();

		const now = new Date();
		const reason = input.reason ?? `Admin ${action} on report ${report.id}`;

		if (action === 'dismiss') {
			const updated = await this.reports.resolveIfOpen(report.id, {
				status: 'dismissed',
				resolvedBy: adminId,
				resolvedAt: now,
			});
			if (!updated) throw alreadyResolved();
			await this.appendActionAudit({
				adminId,
				action,
				report,
				updated,
				targetUserId: null,
				moderationActionId: null,
				reason,
				ipAddress,
			});
			return { success: true, report: await this.toDetail(updated) };
		}

		const targetUserId = await this.reports.findTargetUserId(report.subjectType, report.subjectId);
		if (targetUserId === null) throw targetNotFound();

		const moderationAction = await this.moderation.insertAction({
			targetUserId,
			action: WIRE_TO_MODERATION_ACTION[action],
			severity: ACTION_SEVERITY[action],
			reason,
			performedBy: adminId,
			expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
		});

		if (action === 'suspend') {
			await this.moderation.setUserStatus(targetUserId, 'suspended');
		} else if (action === 'restore') {
			await this.moderation.setUserStatus(targetUserId, 'active');
		}

		const updated = await this.reports.resolveIfOpen(report.id, {
			status: 'resolved',
			resolvedBy: adminId,
			resolvedAt: now,
		});
		if (!updated) throw alreadyResolved();

		await this.appendActionAudit({
			adminId,
			action,
			report,
			updated,
			targetUserId,
			moderationActionId: moderationAction.id,
			reason,
			ipAddress,
		});
		return { success: true, report: await this.toDetail(updated) };
	}

	async listAuditLog(query: AuditLogQueryType): Promise<AuditLogResponseType> {
		const page = query.page ?? 1;
		const limit = query.limit ?? 25;
		const { entries, total } = await this.audit.list({
			page,
			limit,
			actorId: query.actorId,
			entityType: query.entityType,
			entityId: query.entityId,
			action: query.action,
		});
		return {
			entries: entries.map((entry: AuditEntry) => ({
				id: entry.id,
				actorId: entry.actorId,
				actorEmail: entry.actorEmail,
				action: entry.action,
				entityType: entry.entityType,
				entityId: entry.entityId,
				before: entry.before,
				after: entry.after,
				ipAddress: entry.ipAddress,
				createdAt: toIso(entry.createdAt),
			})),
			total,
			page,
			limit,
		};
	}

	private async toDetail(row: ReportRow): Promise<ReportDetailType> {
		const subjectSnapshot = await this.reports.findSubjectSnapshot(row.subjectType, row.subjectId);
		return {
			id: row.id,
			reason: row.reason,
			description: row.description,
			category: row.subjectType,
			status: row.status,
			createdAt: toIso(row.createdAt),
			updatedAt: toIso(row.updatedAt),
			subjectId: row.subjectId,
			subjectSnapshot,
			resolvedBy: row.resolvedBy,
			resolvedAt: toIsoOrNull(row.resolvedAt),
		};
	}

	private async appendActionAudit(input: {
		adminId: string;
		action: string;
		report: ReportRow;
		updated: ReportRow;
		targetUserId: string | null;
		moderationActionId: string | null;
		reason: string;
		ipAddress: string | null;
	}): Promise<void> {
		await this.audit.append({
			actorId: input.adminId,
			action: input.action,
			entityType: 'report',
			entityId: input.report.id,
			before: {
				status: input.report.status,
				subjectType: input.report.subjectType,
				subjectId: input.report.subjectId,
			},
			after: {
				status: input.updated.status,
				resolvedBy: input.updated.resolvedBy,
				resolvedAt: toIsoOrNull(input.updated.resolvedAt),
				targetUserId: input.targetUserId,
				subjectType: input.report.subjectType,
				subjectId: input.report.subjectId,
				reason: input.reason,
				moderationActionId: input.moderationActionId,
			},
			ipAddress: input.ipAddress,
		});
	}
}
