import type { Sql } from '@together/db';
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

interface MatchRow {
	contributor_id: string;
	score: string;
	reasons: unknown;
}

interface PrefsRow {
	user_id: string;
	in_app_enabled: boolean;
	notify_new_matches: boolean;
	notify_remote: boolean;
	notify_local: boolean;
	notify_resource_lending: boolean;
	notify_mentorship: boolean;
}

interface RequestRow {
	id: string;
	author_id: string;
	category_id: number | null;
	modality: string | null;
	help_type: string | null;
	location: string | null;
	title: string;
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

const FREQUENCY_CAPS: Record<string, { cap: number; window: string; windowHours: number }> = {
	in_app: { cap: 3, window: '24h', windowHours: 24 },
};

function isCategoryDisabled(request: Pick<RequestRow, 'help_type'>, prefs: PrefsRow): boolean {
	if (!prefs.notify_new_matches) return true;
	if (request.help_type !== null && request.help_type !== undefined) {
		if (LENDING_HELP_TYPES.includes(request.help_type) && !prefs.notify_resource_lending)
			return true;
		if (MENTOR_HELP_TYPES.includes(request.help_type) && !prefs.notify_mentorship) return true;
	}
	return false;
}

function isChannelDisabled(prefs: PrefsRow): boolean {
	return !prefs.in_app_enabled;
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
	sql: Sql,
	requestId: string,
): Promise<{ sent: number; suppressed: number }> {
	const requestRows = await sql<RequestRow[]>`
		SELECT id, author_id, category_id, modality, help_type, location, title
		FROM requests WHERE id = ${requestId}
	`;
	const request = requestRows[0];
	if (!request) return { sent: 0, suppressed: 0 };

	const matches = await sql<MatchRow[]>`
		SELECT contributor_id, score, reasons
		FROM request_matches
		WHERE request_id = ${requestId} AND notified_at IS NULL
	`;

	if (matches.length === 0) return { sent: 0, suppressed: 0 };

	const contributorIds = matches.map((m) => m.contributor_id);

	const prefsRows =
		contributorIds.length > 0
			? await sql<PrefsRow[]>`
				SELECT user_id, in_app_enabled, notify_new_matches, notify_remote, notify_local,
					notify_resource_lending, notify_mentorship
				FROM notification_preferences
				WHERE user_id = ANY(${contributorIds}::uuid[])
			`
			: [];
	const prefsByUser = new Map(prefsRows.map((row) => [row.user_id, row]));

	const now = new Date();
	const freqCap = FREQUENCY_CAPS.in_app;
	const windowStart = new Date(now.getTime() - freqCap.windowHours * 3600 * 1000);

	const recentNotificationCounts =
		contributorIds.length > 0
			? await sql<{ user_id: string; count: number }[]>`
				SELECT user_id, count(*)::int AS count
				FROM notifications
				WHERE user_id = ANY(${contributorIds}::uuid[])
					AND type = 'new_match'
					AND created_at > ${windowStart}
				GROUP BY user_id
			`
			: [];
	const recentCountsByUser = new Map(
		recentNotificationCounts.map((row) => [row.user_id, row.count]),
	);

	let sent = 0;
	let suppressed = 0;

	for (const match of matches) {
		const contributorId = match.contributor_id;
		const reasons = (match.reasons ?? {}) as {
			factor_breakdown?: FactorBreakdown;
		};
		const factorBreakdown = reasons.factor_breakdown ?? ({} as FactorBreakdown);

		const prefs = prefsByUser.get(contributorId);
		const resolvedPrefs: PrefsRow = {
			user_id: contributorId,
			in_app_enabled: true,
			notify_new_matches: true,
			notify_remote: true,
			notify_local: true,
			notify_resource_lending: true,
			notify_mentorship: true,
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

		if (isCategoryDisabled(request, resolvedPrefs)) {
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

		await sql`
			INSERT INTO notification_dispatch_log
				(request_id, user_id, match_factors, decision, reason, caps_evaluated, cap_window)
			VALUES
				(${requestId}, ${contributorId}, ${JSON.stringify(factorBreakdown)}, ${decision}, ${reason}, ${JSON.stringify(capsEvaluated)}, ${freqCap.window})
		`;

		if (decision === 'sent') {
			const { title, body } = buildNotificationBody(factorBreakdown, request.title);
			await sql`
				INSERT INTO notifications (user_id, request_id, type, title, body, data)
				VALUES (${contributorId}, ${requestId}, 'new_match', ${title}, ${body}, ${JSON.stringify({ factor_breakdown: factorBreakdown })})
				ON CONFLICT (request_id, user_id) DO NOTHING
			`;
			await sql`
				UPDATE request_matches
				SET notified_at = now()
				WHERE request_id = ${requestId} AND contributor_id = ${contributorId}
			`;
			sent += 1;
		} else {
			suppressed += 1;
		}
	}

	return { sent, suppressed };
}

/**
 * Inline notification service for testing — dispatches directly without queue.
 */
export interface NotificationService {
	dispatch(requestId: string): Promise<{ sent: number; suppressed: number }>;
}

export function createInlineNotificationService(sql: Sql): NotificationService {
	return {
		dispatch: (requestId: string) => dispatchNotifications(sql, requestId),
	};
}
