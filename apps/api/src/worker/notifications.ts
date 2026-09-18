import type { Db } from '../infra/database';
import { and, eq, gt, inArray, isNull, sql } from '../infra/database';
import {
	notificationDispatchLog,
	notificationPreferences,
	notifications,
	requestMatches,
	requests,
} from '../infra/database/schema';
import type { FactorBreakdown } from './matching';

// ---------------------------------------------------------------------------
// Notification Dispatch Worker — Issue #13
//
// Reads request_matches rows for a published request, checks notification
// preferences and frequency caps, then creates in-app notifications for
// eligible contributors. Every dispatch attempt (sent or suppressed) is
// logged to notification_dispatch_log for auditability.
//
// No LLM calls on this path — templates only (Section 65.6).
// ---------------------------------------------------------------------------

export const NOTIFICATION_QUEUE = 'notification-dispatch';

export interface NotificationDispatchJobData {
	requestId: string;
}

interface NotificationPrefCaps {
	category_disabled: boolean;
	channel_disabled: boolean;
	frequency_cap_exceeded: boolean;
	frequency_count: number;
	frequency_cap: number;
	frequency_window: string;
}

const LENDING_HELP_TYPES = ['borrow', 'receive', 'access'];
const MENTOR_HELP_TYPES = ['learn', 'collaborate'];

const FREQUENCY_CAPS = {
	in_app: { cap: 3, window: '24h', windowHours: 24 },
} as const;

function isCategoryDisabled(
	helpType: string | null,
	prefs: {
		notifyNewMatches: boolean;
		notifyResourceLending: boolean;
		notifyMentorship: boolean;
	},
): boolean {
	if (!prefs.notifyNewMatches) return true;
	if (helpType !== null && helpType !== undefined) {
		if (LENDING_HELP_TYPES.includes(helpType) && !prefs.notifyResourceLending) return true;
		if (MENTOR_HELP_TYPES.includes(helpType) && !prefs.notifyMentorship) return true;
	}
	return false;
}

function isChannelDisabled(prefs: { inAppEnabled: boolean }): boolean {
	return !prefs.inAppEnabled;
}

/**
 * Build the templated notification body from factor breakdown.
 * Section 65.6: templates only, no LLM calls.
 */
export function buildNotificationBody(
	factorBreakdown: FactorBreakdown,
	requestTitle: string,
): { title: string; body: string } {
	const factors: string[] = [];

	if (factorBreakdown.capability_match >= 0.8) {
		factors.push('capability match');
	}
	if (factorBreakdown.modality_fit >= 0.8) {
		factors.push('modality fit');
	}
	if (factorBreakdown.location_proximity >= 0.8) {
		factors.push('location proximity');
	}
	if (factorBreakdown.reliability >= 0.7) {
		factors.push('strong reliability signal');
	}

	const reason = factors.length > 0 ? ` (${factors.join(', ')})` : '';

	return {
		title: `New match: ${requestTitle}`,
		body: `You have a new match for "${requestTitle}"${reason}. Review and respond if you can help.`,
	};
}

/**
 * Core dispatch logic for one request. Reads matches, checks preferences
 * and caps, creates notifications, and logs every attempt.
 */
export async function dispatchNotifications(
	db: Db,
	requestId: string,
): Promise<{ sent: number; suppressed: number }> {
	const requestRows = await db
		.select({
			id: requests.id,
			authorId: requests.authorId,
			categoryId: requests.categoryId,
			modality: requests.modality,
			helpType: requests.helpType,
			location: requests.location,
			title: requests.title,
		})
		.from(requests)
		.where(eq(requests.id, requestId));

	const request = requestRows[0];
	if (!request) return { sent: 0, suppressed: 0 };

	const matches = await db
		.select({
			contributorId: requestMatches.contributorId,
			score: requestMatches.score,
			reasons: requestMatches.reasons,
		})
		.from(requestMatches)
		.where(and(eq(requestMatches.requestId, requestId), isNull(requestMatches.notifiedAt)));

	if (matches.length === 0) return { sent: 0, suppressed: 0 };

	const contributorIds = matches.map((m) => m.contributorId);

	const prefsRows =
		contributorIds.length > 0
			? await db
					.select()
					.from(notificationPreferences)
					.where(inArray(notificationPreferences.userId, contributorIds))
			: [];
	const prefsByUser = new Map(prefsRows.map((row) => [row.userId, row]));

	const now = new Date();
	const freqCap = FREQUENCY_CAPS.in_app;
	const windowStart = new Date(now.getTime() - freqCap.windowHours * 3600 * 1000);

	const recentNotificationCounts =
		contributorIds.length > 0
			? await db
					.select({
						userId: notifications.userId,
						count: sql<number>`count(*)::int`,
					})
					.from(notifications)
					.where(
						and(
							inArray(notifications.userId, contributorIds),
							eq(notifications.type, 'new_match'),
							gt(notifications.createdAt, windowStart),
						),
					)
					.groupBy(notifications.userId)
			: [];
	const recentCountsByUser = new Map(
		recentNotificationCounts.map((row) => [row.userId, row.count]),
	);

	let sent = 0;
	let suppressed = 0;

	const dispatchLogs: (typeof notificationDispatchLog.$inferInsert)[] = [];
	const notificationsToInsert: (typeof notifications.$inferInsert)[] = [];
	const sentContributorIds: string[] = [];

	for (const match of matches) {
		const contributorId = match.contributorId;
		const reasons = (match.reasons ?? {}) as {
			factor_breakdown?: FactorBreakdown;
		};
		const factorBreakdown = reasons.factor_breakdown ?? ({} as FactorBreakdown);

		const prefs = prefsByUser.get(contributorId);
		const resolvedPrefs = {
			inAppEnabled: true,
			notifyNewMatches: true,
			notifyRemote: true,
			notifyLocal: true,
			notifyResourceLending: true,
			notifyMentorship: true,
			...prefs,
		};

		const capsEvaluated: NotificationPrefCaps = {
			category_disabled: false,
			channel_disabled: false,
			frequency_cap_exceeded: false,
			frequency_count: recentCountsByUser.get(contributorId) ?? 0,
			frequency_cap: freqCap.cap,
			frequency_window: freqCap.window,
		};

		let decision = 'sent';
		let reason: string | null = null;

		if (isCategoryDisabled(request.helpType, resolvedPrefs)) {
			decision = 'suppressed';
			reason = 'category_disabled';
			capsEvaluated.category_disabled = true;
		} else if (isChannelDisabled(resolvedPrefs)) {
			decision = 'suppressed';
			reason = 'channel_disabled';
			capsEvaluated.channel_disabled = true;
		} else if (capsEvaluated.frequency_count >= freqCap.cap) {
			decision = 'suppressed';
			reason = 'frequency_cap_exceeded';
			capsEvaluated.frequency_cap_exceeded = true;
		}

		dispatchLogs.push({
			requestId,
			userId: contributorId,
			matchFactors: factorBreakdown as unknown as Record<string, unknown>,
			decision,
			reason,
			capsEvaluated: capsEvaluated as unknown as Record<string, unknown>,
			capWindow: freqCap.window,
		});

		if (decision === 'sent') {
			const { title, body } = buildNotificationBody(factorBreakdown, request.title);
			notificationsToInsert.push({
				userId: contributorId,
				requestId,
				type: 'new_match',
				title,
				body,
				data: { factor_breakdown: factorBreakdown } as Record<string, unknown>,
			});
			sentContributorIds.push(contributorId);
			sent += 1;
		} else {
			suppressed += 1;
		}
	}

	if (dispatchLogs.length > 0) {
		await db.insert(notificationDispatchLog).values(dispatchLogs);
	}

	if (notificationsToInsert.length > 0) {
		await db
			.insert(notifications)
			.values(notificationsToInsert)
			.onConflictDoNothing({
				target: [notifications.requestId, notifications.userId],
			});
	}

	if (sentContributorIds.length > 0) {
		await db
			.update(requestMatches)
			.set({ notifiedAt: new Date() })
			.where(
				and(
					eq(requestMatches.requestId, requestId),
					inArray(requestMatches.contributorId, sentContributorIds),
				),
			);
	}

	return { sent, suppressed };
}

/**
 * Inline notification service for testing — dispatches directly without queue.
 */
export interface NotificationService {
	dispatch(requestId: string): Promise<{ sent: number; suppressed: number }>;
}

export function createInlineNotificationService(db: Db): NotificationService {
	return {
		dispatch: (requestId: string) => dispatchNotifications(db, requestId),
	};
}
