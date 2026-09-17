import {
	type Contribution,
	type ContributorConfirmation,
	contributions,
	contributorConfirmations,
	type Db,
	eq,
	type OutcomeConfirmation,
	outcomeConfirmations,
	requests,
} from '@together/db';

export class ContributionStore {
	constructor(private readonly db: Db) {}

	async findContributionById(id: string): Promise<Contribution | undefined> {
		const rows = await this.db
			.select()
			.from(contributions)
			.where(eq(contributions.id, id))
			.limit(1);
		return rows[0];
	}

	async findContributionWithRequest(
		id: string,
	): Promise<(Contribution & { requestAuthorId: string }) | undefined> {
		const rows = await this.db
			.select({
				contribution: contributions,
				requestAuthorId: requests.authorId,
			})
			.from(contributions)
			.innerJoin(requests, eq(contributions.requestId, requests.id))
			.where(eq(contributions.id, id))
			.limit(1);
		if (!rows[0]) return undefined;
		return { ...rows[0].contribution, requestAuthorId: rows[0].requestAuthorId };
	}

	async updateContributionStatus(
		id: string,
		status: 'in_progress' | 'completed' | 'cancelled',
		extra?: { startedAt?: Date; completedAt?: Date; notes?: string },
	): Promise<Contribution | undefined> {
		const sets: Record<string, unknown> = { status, updatedAt: new Date() };
		if (extra?.startedAt) sets.startedAt = extra.startedAt;
		if (extra?.completedAt) sets.completedAt = extra.completedAt;
		if (extra?.notes !== undefined) sets.notes = extra.notes;

		const rows = await this.db
			.update(contributions)
			.set(sets)
			.where(eq(contributions.id, id))
			.returning();
		return rows[0];
	}

	async createContributorConfirmation(
		contributionId: string,
		contributorId: string,
		completedAsAgreed: boolean,
	): Promise<ContributorConfirmation> {
		const rows = await this.db
			.insert(contributorConfirmations)
			.values({ contributionId, contributorId, completedAsAgreed })
			.returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to create contributor confirmation');
		return row;
	}

	async findContributorConfirmation(
		contributionId: string,
	): Promise<ContributorConfirmation | undefined> {
		const rows = await this.db
			.select()
			.from(contributorConfirmations)
			.where(eq(contributorConfirmations.contributionId, contributionId))
			.limit(1);
		return rows[0];
	}

	async createOutcomeConfirmation(
		contributionId: string,
		recipientId: string,
		received: boolean,
		response?: string,
		explanation?: string,
	): Promise<OutcomeConfirmation> {
		const rows = await this.db
			.insert(outcomeConfirmations)
			.values({
				contributionId,
				recipientId,
				received,
				response: response as OutcomeConfirmation['response'],
				explanation,
			})
			.returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to create outcome confirmation');
		return row;
	}

	async findOutcomeConfirmation(contributionId: string): Promise<OutcomeConfirmation | undefined> {
		const rows = await this.db
			.select()
			.from(outcomeConfirmations)
			.where(eq(outcomeConfirmations.contributionId, contributionId))
			.limit(1);
		return rows[0];
	}
}

export function toContributionResponse(row: Contribution, opts?: { hideParticipant?: boolean }) {
	return {
		id: row.id,
		requestId: row.requestId,
		contributorId: opts?.hideParticipant ? null : row.contributorId,
		responseId: row.responseId,
		status: row.status,
		startedAt: row.startedAt ? row.startedAt.toISOString() : null,
		completedAt: row.completedAt ? row.completedAt.toISOString() : null,
		notes: row.notes,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}
