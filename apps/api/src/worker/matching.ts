import { jwt } from '@elysiajs/jwt';
import {
	and,
	asc,
	contributions,
	contributorCapabilities,
	type Db,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	ne,
	notInArray,
	notificationPreferences,
	or,
	outcomeConfirmations,
	profiles,
	requestMatches,
	requests,
	skills,
	sql,
	users,
} from '@together/db';
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

export function createInlineMatchingService(db: Db, now?: () => Date): MatchingService {
	return {
		recompute: (requestId: string) => recomputeMatches(db, requestId, { now }).then(() => {}),
	};
}

interface RequestRow {
	id: string;
	authorId: string;
	categoryId: number | null;
	modality: string | null;
	helpType: string | null;
	location: string | null;
	title: string;
	goal: string;
	barrier: string;
	helpNeeded: string;
	timeCommitment: string | null;
	duration: string | null;
	deadline: Date | null;
	skillLevel: string | null;
	intendedOutcome: string | null;
	quantity: string | null;
}

interface CapabilityRow {
	userId: string;
	categoryId: number | null;
	skillId: number | null;
	modality: string;
	location: string | null;
}

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
	request: {
		location?: string | null;
		modality?: string | null;
		helpType?: string | null;
		help_type?: string | null;
	},
	prefs:
		| {
				notifyNewMatches?: boolean;
				notifyRemote?: boolean;
				notifyLocal?: boolean;
				notifyResourceLending?: boolean;
				notifyMentorship?: boolean;
				notify_new_matches?: boolean;
				notify_remote?: boolean;
				notify_local?: boolean;
				notify_resource_lending?: boolean;
				notify_mentorship?: boolean;
		  }
		| undefined,
): boolean {
	const notifyNewMatches = prefs?.notifyNewMatches ?? prefs?.notify_new_matches ?? true;
	const notifyRemote = prefs?.notifyRemote ?? prefs?.notify_remote ?? true;
	const notifyLocal = prefs?.notifyLocal ?? prefs?.notify_local ?? true;
	const notifyResourceLending =
		prefs?.notifyResourceLending ?? prefs?.notify_resource_lending ?? true;
	const notifyMentorship = prefs?.notifyMentorship ?? prefs?.notify_mentorship ?? true;

	if (!notifyNewMatches) return false;
	if (requestRequiresLocation(request as Pick<RequestRow, 'location' | 'modality'>)) {
		if (!notifyLocal) return false;
	} else if (!notifyRemote) {
		return false;
	}
	const helpType = request.helpType ?? request.help_type;
	if (helpType !== null && helpType !== undefined) {
		if (LENDING_HELP_TYPES.includes(helpType) && !notifyResourceLending) return false;
		if (MENTOR_HELP_TYPES.includes(helpType) && !notifyMentorship) return false;
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

export function requestQualityScore(request: {
	modality?: string | null;
	helpType?: string | null;
	help_type?: string | null;
	location?: string | null;
	timeCommitment?: string | null;
	time_commitment?: string | null;
	duration?: string | null;
	deadline?: Date | string | null;
	skillLevel?: string | null;
	skill_level?: string | null;
	intendedOutcome?: string | null;
	intended_outcome?: string | null;
	quantity?: string | null;
}): number {
	const optional: (string | Date | null)[] = [
		request.modality ?? null,
		request.helpType ?? request.help_type ?? null,
		request.location ?? null,
		request.timeCommitment ?? request.time_commitment ?? null,
		request.duration ?? null,
		request.deadline ? new Date(request.deadline) : null,
		request.skillLevel ?? request.skill_level ?? null,
		request.intendedOutcome ?? request.intended_outcome ?? null,
		request.quantity ?? null,
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
	db: Db,
	requestId: string,
	options: { now?: () => Date } = {},
): Promise<MatchResult[]> {
	const now = options.now?.() ?? new Date();

	const requestRows = await db
		.select({
			id: requests.id,
			authorId: requests.authorId,
			categoryId: requests.categoryId,
			modality: requests.modality,
			helpType: requests.helpType,
			location: requests.location,
			title: requests.title,
			goal: requests.goal,
			barrier: requests.barrier,
			helpNeeded: requests.helpNeeded,
			timeCommitment: requests.timeCommitment,
			duration: requests.duration,
			deadline: requests.deadline,
			skillLevel: requests.skillLevel,
			intendedOutcome: requests.intendedOutcome,
			quantity: requests.quantity,
		})
		.from(requests)
		.where(eq(requests.id, requestId))
		.limit(1);

	const request = requestRows[0];
	if (!request) return [];
	if (request.categoryId === null) {
		await db
			.delete(requestMatches)
			.where(and(eq(requestMatches.requestId, requestId), isNull(requestMatches.notifiedAt)));
		return [];
	}
	const categoryId = request.categoryId;

	const skillRows = await db
		.select({ id: skills.id })
		.from(skills)
		.where(and(eq(skills.categoryId, categoryId), isNull(skills.retiredAt)));
	const skillIds = skillRows.map((row) => row.id);

	const capabilityFilter =
		skillIds.length > 0
			? or(
					eq(contributorCapabilities.categoryId, categoryId),
					inArray(contributorCapabilities.skillId, skillIds),
				)
			: eq(contributorCapabilities.categoryId, categoryId);

	const capabilities = await db
		.select({
			userId: contributorCapabilities.userId,
			categoryId: contributorCapabilities.categoryId,
			skillId: contributorCapabilities.skillId,
			modality: contributorCapabilities.modality,
			location: contributorCapabilities.location,
		})
		.from(contributorCapabilities)
		.innerJoin(users, eq(users.id, contributorCapabilities.userId))
		.where(
			and(
				capabilityFilter,
				ne(contributorCapabilities.userId, request.authorId),
				eq(users.status, 'active'),
				isNull(users.deletedAt),
			),
		)
		.limit(1000);

	if (capabilities.length === 0) {
		await db
			.delete(requestMatches)
			.where(and(eq(requestMatches.requestId, requestId), isNull(requestMatches.notifiedAt)));
		return [];
	}

	const byUser = new Map<string, CapabilityRow[]>();
	for (const cap of capabilities) {
		const list = byUser.get(cap.userId) ?? [];
		list.push(cap);
		byUser.set(cap.userId, list);
	}
	const userIds = [...byUser.keys()].slice(0, MAX_CANDIDATES);
	const skillIdSet = new Set(skillIds);

	const prefsRows =
		userIds.length > 0
			? await db
					.select({
						userId: notificationPreferences.userId,
						notifyNewMatches: notificationPreferences.notifyNewMatches,
						notifyRemote: notificationPreferences.notifyRemote,
						notifyLocal: notificationPreferences.notifyLocal,
						notifyResourceLending: notificationPreferences.notifyResourceLending,
						notifyMentorship: notificationPreferences.notifyMentorship,
					})
					.from(notificationPreferences)
					.where(inArray(notificationPreferences.userId, userIds))
			: [];
	const prefsByUser = new Map(prefsRows.map((row) => [row.userId, row]));

	const completedRows =
		userIds.length > 0
			? await db
					.select({
						contributorId: contributions.contributorId,
						completed: sql<number>`count(*)::int`,
					})
					.from(contributions)
					.where(
						and(
							inArray(contributions.contributorId, userIds),
							eq(contributions.status, 'completed'),
						),
					)
					.groupBy(contributions.contributorId)
			: [];
	const completedByUser = new Map(completedRows.map((row) => [row.contributorId, row.completed]));

	const confirmationRows =
		userIds.length > 0
			? await db
					.select({
						contributorId: contributions.contributorId,
						total: sql<number>`count(*)::int`,
						helpful: sql<number>`count(*) FILTER (WHERE ${outcomeConfirmations.response} = ANY(ARRAY['yes_significantly', 'yes_somewhat']::outcome_response[]))::int`,
					})
					.from(outcomeConfirmations)
					.innerJoin(contributions, eq(contributions.id, outcomeConfirmations.contributionId))
					.where(inArray(contributions.contributorId, userIds))
					.groupBy(contributions.contributorId)
			: [];
	const confirmationsByUser = new Map(
		confirmationRows.map((row) => [row.contributorId, { helpful: row.helpful, total: row.total }]),
	);

	const windowStart = new Date(now.getTime() - FATIGUE_WINDOW_HOURS * 3600 * 1000);
	const recentRows =
		userIds.length > 0
			? await db
					.select({
						contributorId: requestMatches.contributorId,
						recent: sql<number>`count(*)::int`,
					})
					.from(requestMatches)
					.where(
						and(
							inArray(requestMatches.contributorId, userIds),
							ne(requestMatches.requestId, requestId),
							gt(requestMatches.createdAt, windowStart),
						),
					)
					.groupBy(requestMatches.contributorId)
			: [];
	const recentByUser = new Map(recentRows.map((row) => [row.contributorId, row.recent]));

	const profileRows =
		userIds.length > 0
			? await db
					.select({
						userId: profiles.userId,
						location: profiles.location,
					})
					.from(profiles)
					.where(inArray(profiles.userId, userIds))
			: [];
	const profileLocationByUser = new Map(profileRows.map((row) => [row.userId, row.location]));

	const requiresLocation = requestRequiresLocation(request);
	const quality = requestQualityScore(request);

	const scored: Omit<MatchResult, 'rank'>[] = [];
	for (const userId of userIds) {
		if (!passesPreferencesGate(request, prefsByUser.get(userId))) continue;
		const caps = (byUser.get(userId) ?? []).sort((a, b) => {
			const sa = a.skillId ?? -1;
			const sb = b.skillId ?? -1;
			if (sa !== sb) return sa - sb;
			return (a.categoryId ?? -1) - (b.categoryId ?? -1);
		});
		const hasSkillOverlap = caps.some((cap) => cap.skillId !== null && skillIdSet.has(cap.skillId));
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
		await db
			.delete(requestMatches)
			.where(and(eq(requestMatches.requestId, requestId), isNull(requestMatches.notifiedAt)));
		return [];
	}

	const keepContributorIds = ranked.map((r) => r.contributorId);
	const rowsToUpsert = ranked.map((row) => ({
		requestId,
		contributorId: row.contributorId,
		score: String(row.totalScore),
		reasons: {
			total_score: row.totalScore,
			rank: row.rank,
			weights: { ...MATCH_WEIGHTS },
			factor_breakdown: { ...row.factorBreakdown },
		},
	}));

	await db.transaction(async (tx) => {
		await tx
			.insert(requestMatches)
			.values(rowsToUpsert)
			.onConflictDoUpdate({
				target: [requestMatches.requestId, requestMatches.contributorId],
				set: {
					score: sql`excluded.score`,
					reasons: sql`excluded.reasons`,
				},
			});
		await tx
			.delete(requestMatches)
			.where(
				and(
					eq(requestMatches.requestId, requestId),
					notInArray(requestMatches.contributorId, keepContributorIds),
					isNull(requestMatches.notifiedAt),
				),
			);
	});

	return ranked;
}

/** Read stored matches back under the issue's `total_score`/`rank`/`factor_breakdown` names. */
export async function readMatches(db: Db, requestId: string): Promise<MatchResult[]> {
	const rows = await db
		.select({
			contributorId: requestMatches.contributorId,
			score: requestMatches.score,
			reasons: requestMatches.reasons,
		})
		.from(requestMatches)
		.where(eq(requestMatches.requestId, requestId))
		.orderBy(desc(requestMatches.score), asc(requestMatches.contributorId));

	return rows.map((row, index) => {
		const reasons = (row.reasons ?? {}) as {
			total_score?: number;
			rank?: number;
			factor_breakdown?: FactorBreakdown;
		};
		return {
			contributorId: row.contributorId,
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
export function createInternalMatchingRouter(
	db: Db,
	options: InternalMatchingRouterOptions,
) {
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
			const exists = await db
				.select({ id: requests.id })
				.from(requests)
				.where(eq(requests.id, params.id))
				.limit(1);
			if (!exists[0]) {
				set.status = 404;
				return { error: 'NOT_FOUND', message: 'Request not found' };
			}
			const matches = await readMatches(db, params.id);
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
