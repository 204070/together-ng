import { jwt } from '@elysiajs/jwt';
import type { Sql } from '@together/db';
import { Elysia, t } from 'elysia';
import type { JwtVerifier } from '../lib/authentication';
import { HttpError } from '../lib/errors';
import { requireAdmin } from '../modules/admin/routes';
import type { UserRow } from '../modules/auth/store';

// ---------------------------------------------------------------------------
// Basic Matching Engine — Phase 1 deterministic scoring (PRD 65.5).
//
// No LLM or external calls anywhere on this path (D7, D17):
// every sub-score below is pure arithmetic over rows already in Postgres,
// so re-running the worker over the same input state yields identical
// scores and ranking.
//
// Column mapping (no migration in this issue): the checked-in
// `request_matches` table has `score NUMERIC` + `reasons JSONB`, not the
// `total_score` / `rank` / `factor_breakdown` columns the issue names.
// Until a wave allows that migration, this worker stores:
//   score   <- total_score (0-100)
//   reasons <- { total_score, rank, weights, factor_breakdown }
// and `GET /internal/requests/:id/matches` below re-exposes those names.
// Needed migration (for a future wave, NOT generated here):
//   ALTER TABLE request_matches
//     ADD COLUMN total_score numeric NOT NULL,
//     ADD COLUMN rank integer NOT NULL,
//     ADD COLUMN factor_breakdown jsonb NOT NULL;
// at which point `score`/`reasons` become read aliases.
//
// Weights (highest weight on capability match, per the issue):
//   capability_match         0.40
//   modality_fit             0.15
//   location_proximity       0.10
//   availability_preferences 0.10 (binary gate; every stored row passed it)
//   reliability              0.10
//   fatigue_dampening        0.10
//   request_quality          0.05
// ---------------------------------------------------------------------------

export const MATCH_WEIGHTS = {
	capability_match: 0.4,
	modality_fit: 0.15,
	location_proximity: 0.1,
	availability_preferences: 0.1,
	reliability: 0.1,
	fatigue_dampening: 0.1,
	request_quality: 0.05,
} as const;

export type FactorName = keyof typeof MATCH_WEIGHTS;

export type FactorBreakdown = Record<FactorName, number>;

export interface MatchResult {
	contributorId: string;
	totalScore: number;
	rank: number;
	factorBreakdown: FactorBreakdown;
}

export interface MatchingService {
	recompute(requestId: string): Promise<void>;
}

export function createInlineMatchingService(sql: Sql, now?: () => Date): MatchingService {
	return {
		recompute: (requestId: string) => recomputeMatches(sql, requestId, { now }).then(() => {}),
	};
}

interface RequestRow {
	id: string;
	author_id: string;
	category_id: number | null;
	modality: string | null;
	help_type: string | null;
	location: string | null;
	title: string;
	goal: string;
	barrier: string;
	help_needed: string;
	time_commitment: string | null;
	duration: string | null;
	deadline: Date | null;
	skill_level: string | null;
	intended_outcome: string | null;
	quantity: string | null;
}

interface CapabilityRow {
	user_id: string;
	category_id: number | null;
	skill_id: number | null;
	modality: string;
	location: string | null;
}

interface PrefsRow {
	user_id: string;
	notify_new_matches: boolean;
	notify_remote: boolean;
	notify_local: boolean;
	notify_resource_lending: boolean;
	notify_mentorship: boolean;
}

const HELPFUL_RESPONSES = ['yes_significantly', 'yes_somewhat'];
const LENDING_HELP_TYPES = ['borrow', 'receive', 'access'];
const MENTOR_HELP_TYPES = ['learn', 'collaborate'];
const FATIGUE_WINDOW_HOURS = 24;
const FATIGUE_DECAY = 0.25;

function normalizeLocation(value: string | null | undefined): string | null {
	if (value === null || value === undefined) return null;
	const trimmed = value.trim().toLowerCase();
	return trimmed === '' ? null : trimmed;
}

/** A request requires physical proximity when it names a place or is in-person-only. */
export function requestRequiresLocation(
	request: Pick<RequestRow, 'location' | 'modality'>,
): boolean {
	return normalizeLocation(request.location) !== null || request.modality === 'in_person';
}

/**
 * Preference gate. `notification_preferences` has no per-category rows, so the
 * request's category/channel opt-out maps onto the stored flags as follows:
 * - `notify_new_matches = false` opts out of matching entirely;
 * - a location-requiring request needs `notify_local`, otherwise `notify_remote`;
 * - borrow/receive/access help needs `notify_resource_lending`;
 * - learn/collaborate help needs `notify_mentorship`.
 * Contributors without a preferences row get the all-true defaults.
 */
export function passesPreferencesGate(
	request: Pick<RequestRow, 'location' | 'modality' | 'help_type'>,
	prefs: PrefsRow | undefined,
): boolean {
	const p = {
		notify_new_matches: true,
		notify_remote: true,
		notify_local: true,
		notify_resource_lending: true,
		notify_mentorship: true,
		...prefs,
	};
	if (!p.notify_new_matches) return false;
	if (requestRequiresLocation(request)) {
		if (!p.notify_local) return false;
	} else if (!p.notify_remote) {
		return false;
	}
	if (request.help_type !== null && request.help_type !== undefined) {
		if (LENDING_HELP_TYPES.includes(request.help_type) && !p.notify_resource_lending) return false;
		if (MENTOR_HELP_TYPES.includes(request.help_type) && !p.notify_mentorship) return false;
	}
	return true;
}

function modalityFit(requestModality: string | null, capabilityModality: string): number {
	if (requestModality === null || requestModality === 'both') return 1;
	if (capabilityModality === 'both') return 1;
	return requestModality === capabilityModality ? 1 : 0.2;
}

function capabilityScore(hasSkillOverlap: boolean, intersectingRows: number): number {
	const base = hasSkillOverlap ? 1 : 0.6;
	const breadth = Math.min(0.05 * Math.max(intersectingRows - 1, 0), 0.15);
	return Math.min(base + breadth, 1);
}

function locationScore(
	requiresLocation: boolean,
	requestLocation: string | null,
	candidateLocations: (string | null)[],
): number {
	if (!requiresLocation) return 0.5;
	const want = normalizeLocation(requestLocation);
	const have = candidateLocations
		.map(normalizeLocation)
		.filter((loc): loc is string => loc !== null);
	if (have.some((loc) => loc === want)) return 1;
	if (have.length === 0) return 0.4;
	return 0.2;
}

function reliabilityScore(completedContributions: number, helpful: number, total: number): number {
	const completedPart = 0.4 * (Math.min(completedContributions, 10) / 10);
	const ratio = total > 0 ? helpful / total : 0.5;
	return Math.min(0.4 + completedPart + 0.2 * ratio, 1);
}

function fatigueScore(recentMatches: number): number {
	return Math.exp(-FATIGUE_DECAY * recentMatches);
}

/** Request-level factor: fraction of optional structured fields filled (0.4-1.0). */
export function requestQualityScore(request: RequestRow): number {
	const optional: (string | Date | null)[] = [
		request.modality,
		request.help_type,
		request.location,
		request.time_commitment,
		request.duration,
		request.deadline,
		request.skill_level,
		request.intended_outcome,
		request.quantity,
	];
	const filled = optional.filter((value) => {
		if (value === null || value === undefined) return false;
		if (typeof value === 'string') return value.trim() !== '';
		return true;
	}).length;
	return 0.4 + 0.6 * (filled / optional.length);
}

function round4(value: number): number {
	return Math.round(value * 10000) / 10000;
}

export function totalScore(breakdown: FactorBreakdown): number {
	let sum = 0;
	for (const key of Object.keys(MATCH_WEIGHTS) as FactorName[]) {
		sum += MATCH_WEIGHTS[key] * breakdown[key];
	}
	return round4(100 * sum);
}

/**
 * Recompute every `request_matches` row for one request inside a single
 * transaction (delete + insert), so re-running over unchanged input yields
 * byte-identical rows. Contributors are ordered by total score descending
 * with contributor id ascending as the deterministic tiebreak.
 */
export const MAX_CANDIDATES = 200;

export async function recomputeMatches(
	sql: Sql,
	requestId: string,
	options: { now?: () => Date } = {},
): Promise<MatchResult[]> {
	const now = options.now?.() ?? new Date();

	const requestRows = await sql<RequestRow[]>`
		SELECT id, author_id, category_id, modality, help_type, location, title, goal,
			barrier, help_needed, time_commitment, duration, deadline, skill_level,
			intended_outcome, quantity
		FROM requests WHERE id = ${requestId}
	`;
	const request = requestRows[0];
	if (!request) return [];
	if (request.category_id === null) {
		await sql`DELETE FROM request_matches WHERE request_id = ${requestId} AND notified_at IS NULL`;
		return [];
	}
	const categoryId = request.category_id;

	const skillRows = await sql<{ id: number }[]>`
		SELECT id FROM skills WHERE category_id = ${categoryId} AND retired_at IS NULL
	`;
	const skillIds = skillRows.map((row) => row.id);

	let capabilities: CapabilityRow[];
	if (skillIds.length > 0) {
		capabilities = await sql<CapabilityRow[]>`
			SELECT cc.user_id, cc.category_id, cc.skill_id, cc.modality, cc.location
			FROM contributor_capabilities cc
			JOIN users u ON u.id = cc.user_id
			WHERE (cc.category_id = ${categoryId} OR cc.skill_id = ANY(${skillIds}::int[]))
				AND cc.user_id <> ${request.author_id}
				AND u.status = 'active' AND u.deleted_at IS NULL
			LIMIT 1000
		`;
	} else {
		capabilities = await sql<CapabilityRow[]>`
			SELECT cc.user_id, cc.category_id, cc.skill_id, cc.modality, cc.location
			FROM contributor_capabilities cc
			JOIN users u ON u.id = cc.user_id
			WHERE cc.category_id = ${categoryId}
				AND cc.user_id <> ${request.author_id}
				AND u.status = 'active' AND u.deleted_at IS NULL
			LIMIT 1000
		`;
	}

	if (capabilities.length === 0) {
		await sql`DELETE FROM request_matches WHERE request_id = ${requestId} AND notified_at IS NULL`;
		return [];
	}

	const byUser = new Map<string, CapabilityRow[]>();
	for (const cap of capabilities) {
		const list = byUser.get(cap.user_id) ?? [];
		list.push(cap);
		byUser.set(cap.user_id, list);
	}
	const userIds = [...byUser.keys()].slice(0, MAX_CANDIDATES);
	const skillIdSet = new Set(skillIds);

	const prefsRows =
		userIds.length > 0
			? await sql<PrefsRow[]>`
				SELECT user_id, notify_new_matches, notify_remote, notify_local,
					notify_resource_lending, notify_mentorship
				FROM notification_preferences WHERE user_id = ANY(${userIds}::uuid[])
			`
			: [];
	const prefsByUser = new Map(prefsRows.map((row) => [row.user_id, row]));

	const completedRows =
		userIds.length > 0
			? await sql<{ contributor_id: string; completed: number }[]>`
				SELECT contributor_id, count(*)::int AS completed
				FROM contributions
				WHERE contributor_id = ANY(${userIds}::uuid[]) AND status = 'completed'
				GROUP BY contributor_id
			`
			: [];
	const completedByUser = new Map(completedRows.map((row) => [row.contributor_id, row.completed]));

	const confirmationRows =
		userIds.length > 0
			? await sql<{ contributor_id: string; total: number; helpful: number }[]>`
				SELECT c.contributor_id,
					count(*)::int AS total,
					count(*) FILTER (WHERE oc.response = ANY(${HELPFUL_RESPONSES}::outcome_response[]))::int AS helpful
				FROM outcome_confirmations oc
				JOIN contributions c ON c.id = oc.contribution_id
				WHERE c.contributor_id = ANY(${userIds}::uuid[])
				GROUP BY c.contributor_id
			`
			: [];
	const confirmationsByUser = new Map(
		confirmationRows.map((row) => [row.contributor_id, { helpful: row.helpful, total: row.total }]),
	);

	const windowStart = new Date(now.getTime() - FATIGUE_WINDOW_HOURS * 3600 * 1000);
	const recentRows =
		userIds.length > 0
			? await sql<{ contributor_id: string; recent: number }[]>`
				SELECT contributor_id, count(*)::int AS recent
				FROM request_matches
				WHERE contributor_id = ANY(${userIds}::uuid[])
					AND request_id <> ${requestId}
					AND created_at > ${windowStart}
				GROUP BY contributor_id
			`
			: [];
	const recentByUser = new Map(recentRows.map((row) => [row.contributor_id, row.recent]));

	const profileRows =
		userIds.length > 0
			? await sql<{ user_id: string; location: string | null }[]>`
				SELECT user_id, location FROM profiles WHERE user_id = ANY(${userIds}::uuid[])
			`
			: [];
	const profileLocationByUser = new Map(profileRows.map((row) => [row.user_id, row.location]));

	const requiresLocation = requestRequiresLocation(request);
	const quality = requestQualityScore(request);

	const scored: Omit<MatchResult, 'rank'>[] = [];
	for (const userId of userIds) {
		if (!passesPreferencesGate(request, prefsByUser.get(userId))) continue;
		const caps = (byUser.get(userId) ?? []).sort((a, b) => {
			const sa = a.skill_id ?? -1;
			const sb = b.skill_id ?? -1;
			if (sa !== sb) return sa - sb;
			return (a.category_id ?? -1) - (b.category_id ?? -1);
		});
		const hasSkillOverlap = caps.some(
			(cap) => cap.skill_id !== null && skillIdSet.has(cap.skill_id),
		);
		const breakdown: FactorBreakdown = {
			capability_match: capabilityScore(hasSkillOverlap, caps.length),
			modality_fit: Math.max(...caps.map((cap) => modalityFit(request.modality, cap.modality))),
			location_proximity: locationScore(requiresLocation, request.location, [
				...caps.map((cap) => cap.location),
				profileLocationByUser.get(userId) ?? null,
			]),
			availability_preferences: 1,
			reliability: reliabilityScore(
				completedByUser.get(userId) ?? 0,
				confirmationsByUser.get(userId)?.helpful ?? 0,
				confirmationsByUser.get(userId)?.total ?? 0,
			),
			fatigue_dampening: fatigueScore(recentByUser.get(userId) ?? 0),
			request_quality: quality,
		};
		scored.push({
			contributorId: userId,
			totalScore: totalScore(breakdown),
			factorBreakdown: breakdown,
		});
	}

	scored.sort((a, b) => {
		if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
		return a.contributorId < b.contributorId ? -1 : 1;
	});
	const ranked: MatchResult[] = scored.map((row, index) => ({ ...row, rank: index + 1 }));

	if (ranked.length === 0) {
		await sql`DELETE FROM request_matches WHERE request_id = ${requestId} AND notified_at IS NULL`;
		return [];
	}

	const keepContributorIds = ranked.map((r) => r.contributorId);
	const rowsToUpsert = ranked.map((row) => ({
		request_id: requestId,
		contributor_id: row.contributorId,
		score: row.totalScore,
		reasons: sql.json({
			total_score: row.totalScore,
			rank: row.rank,
			weights: { ...MATCH_WEIGHTS },
			factor_breakdown: { ...row.factorBreakdown },
		}),
	}));

	await sql.begin(async (tx) => {
		await tx`
			INSERT INTO request_matches ${tx(rowsToUpsert, 'request_id', 'contributor_id', 'score', 'reasons')}
			ON CONFLICT (request_id, contributor_id)
			DO UPDATE SET
				score = EXCLUDED.score,
				reasons = EXCLUDED.reasons
		`;
		await tx`
			DELETE FROM request_matches
			WHERE request_id = ${requestId}
				AND NOT (contributor_id = ANY(${keepContributorIds}::uuid[]))
				AND notified_at IS NULL
		`;
	});

	return ranked;
}

/** Read stored matches back under the issue's `total_score`/`rank`/`factor_breakdown` names. */
export async function readMatches(sql: Sql, requestId: string): Promise<MatchResult[]> {
	const rows = await sql<{ contributor_id: string; score: string; reasons: unknown }[]>`
		SELECT contributor_id, score::text AS score, reasons
		FROM request_matches WHERE request_id = ${requestId}
		ORDER BY score DESC, contributor_id ASC
	`;
	return rows.map((row, index) => {
		const reasons = (row.reasons ?? {}) as {
			total_score?: number;
			rank?: number;
			factor_breakdown?: FactorBreakdown;
		};
		return {
			contributorId: row.contributor_id,
			totalScore: reasons.total_score ?? Number(row.score),
			rank: reasons.rank ?? index + 1,
			factorBreakdown:
				reasons.factor_breakdown ??
				({
					capability_match: 0,
					modality_fit: 0,
					location_proximity: 0,
					availability_preferences: 0,
					reliability: 0,
					fatigue_dampening: 0,
					request_quality: 0,
				} satisfies FactorBreakdown),
		};
	});
}

export interface InternalMatchingRouterOptions {
	findUserById?: (id: string) => Promise<UserRow | undefined>;
	jwtSecret: string;
}

/** Internal read model for the notification dispatcher (#13) and debugging. */
export function createInternalMatchingRouter(sql: Sql, options: InternalMatchingRouterOptions) {
	if (options.findUserById && !options.jwtSecret) {
		throw new Error('jwtSecret is required when auth is enabled in createInternalMatchingRouter');
	}
	return new Elysia().use(jwt({ name: 'jwt', secret: options.jwtSecret, exp: '15m' })).get(
		'/internal/requests/:id/matches',
		async ({ params, headers, jwt: verifier, set }) => {
			if (options.findUserById) {
				const authHeader = (headers as { authorization?: string }).authorization;
				if (!authHeader) {
					set.status = 401;
					return { error: 'UNAUTHORIZED', message: 'Authentication required' };
				}
				try {
					await requireAdmin(
						headers as { authorization?: string },
						verifier as unknown as JwtVerifier,
						{ findUserById: options.findUserById },
					);
				} catch (err: unknown) {
					if (err instanceof HttpError) {
						set.status = err.status;
						return err.body();
					}
					set.status = 403;
					return { error: 'ADMIN_ACCESS_REQUIRED', message: 'Admin access required' };
				}
			}
			const exists = await sql<{ id: string }[]>`SELECT id FROM requests WHERE id = ${params.id}`;
			if (!exists[0]) {
				set.status = 404;
				return { error: 'NOT_FOUND', message: 'Request not found' };
			}
			const matches = await readMatches(sql, params.id);
			return {
				requestId: params.id,
				matches: matches.map((match) => ({
					contributorId: match.contributorId,
					totalScore: match.totalScore,
					rank: match.rank,
					factorBreakdown: match.factorBreakdown,
				})),
			};
		},
		{ params: t.Object({ id: t.String({ format: 'uuid' }) }) },
	);
}
