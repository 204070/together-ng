import {
	and,
	type Category,
	categories,
	type Db,
	eq,
	inArray,
	type Request,
	type RequestResponse,
	requestResponses,
	requests,
	sql,
	votes,
} from '../../infra/database';

export class RequestStore {
	constructor(private readonly db: Db) {}

	async findCategoryById(id: number): Promise<Category | undefined> {
		const rows = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
		return rows[0];
	}

	async createRequest(authorId: string, input: Record<string, unknown>): Promise<Request> {
		const title = (input.title as string | undefined) ?? '';
		const goal = (input.goal as string | undefined) ?? '';
		const barrier = (input.barrier as string | undefined) ?? '';
		const helpNeeded = (input.helpNeeded as string | undefined) ?? '';
		const categoryId = (input.categoryId as number | undefined) ?? null;
		const modality = (input.modality as string | undefined) ?? null;
		const helpType = (input.helpType as string | undefined) ?? null;
		const location = (input.location as string | undefined) ?? null;
		const timeCommitment = (input.timeCommitment as string | undefined) ?? null;
		const duration = (input.duration as string | undefined) ?? null;
		const deadline = (input.deadline as string | undefined)
			? new Date(input.deadline as string)
			: null;
		const skillLevel = (input.skillLevel as string | undefined) ?? null;
		const intendedOutcome = (input.intendedOutcome as string | undefined) ?? null;
		const quantity = (input.quantity as string | undefined) ?? null;

		const rows = await this.db
			.insert(requests)
			.values({
				authorId,
				title,
				goal,
				barrier,
				helpNeeded,
				categoryId,
				modality: modality as Request['modality'],
				helpType: helpType as Request['helpType'],
				location,
				timeCommitment,
				duration,
				deadline,
				skillLevel: skillLevel as Request['skillLevel'],
				intendedOutcome,
				quantity,
			})
			.returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to create request');
		return row;
	}

	async findRequestById(id: string): Promise<Request | undefined> {
		const rows = await this.db.select().from(requests).where(eq(requests.id, id)).limit(1);
		return rows[0];
	}

	async updateRequest(id: string, patch: Record<string, unknown>): Promise<Request | undefined> {
		const existing = await this.findRequestById(id);
		if (!existing) return undefined;
		const next = {
			title: (patch.title as string | undefined) ?? existing.title,
			goal: (patch.goal as string | undefined) ?? existing.goal,
			barrier: (patch.barrier as string | undefined) ?? existing.barrier,
			helpNeeded:
				patch.helpNeeded !== undefined ? (patch.helpNeeded as string) : existing.helpNeeded,
			categoryId:
				patch.categoryId !== undefined ? (patch.categoryId as number | null) : existing.categoryId,
			state: (patch.state as Request['state']) ?? existing.state,
			modality:
				patch.modality !== undefined ? (patch.modality as Request['modality']) : existing.modality,
			helpType:
				patch.helpType !== undefined ? (patch.helpType as Request['helpType']) : existing.helpType,
			location:
				patch.location !== undefined ? (patch.location as string | null) : existing.location,
			timeCommitment:
				patch.timeCommitment !== undefined
					? (patch.timeCommitment as string | null)
					: existing.timeCommitment,
			duration:
				patch.duration !== undefined ? (patch.duration as string | null) : existing.duration,
			deadline:
				patch.deadline !== undefined
					? patch.deadline
						? new Date(patch.deadline as string)
						: null
					: existing.deadline,
			skillLevel:
				patch.skillLevel !== undefined
					? (patch.skillLevel as Request['skillLevel'])
					: existing.skillLevel,
			intendedOutcome:
				patch.intendedOutcome !== undefined
					? (patch.intendedOutcome as string | null)
					: existing.intendedOutcome,
			quantity:
				patch.quantity !== undefined ? (patch.quantity as string | null) : existing.quantity,
			updatedAt: new Date(),
		};
		const rows = await this.db.update(requests).set(next).where(eq(requests.id, id)).returning();
		return rows[0];
	}

	async publishRequest(id: string): Promise<Request | undefined> {
		const rows = await this.db
			.update(requests)
			.set({
				state: 'published',
				publishedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(requests.id, id))
			.returning();
		return rows[0];
	}

	async addVote(userId: string, requestId: string): Promise<boolean> {
		try {
			return await this.db.transaction(async (tx) => {
				const inserted = await tx
					.insert(votes)
					.values({ userId, requestId })
					.onConflictDoNothing()
					.returning();
				if (inserted.length === 0) return false;
				await tx
					.update(requests)
					.set({
						voteCount: sql`${requests.voteCount} + 1`,
					})
					.where(eq(requests.id, requestId));
				return true;
			});
		} catch {
			return false;
		}
	}

	async removeVote(userId: string, requestId: string): Promise<boolean> {
		try {
			return await this.db.transaction(async (tx) => {
				const result = await tx
					.delete(votes)
					.where(and(eq(votes.userId, userId), eq(votes.requestId, requestId)))
					.returning();
				if (result.length === 0) return false;
				await tx
					.update(requests)
					.set({
						voteCount: sql`greatest(${requests.voteCount} - 1, 0)`,
					})
					.where(eq(requests.id, requestId));
				return true;
			});
		} catch {
			return false;
		}
	}

	async findVote(userId: string, requestId: string): Promise<{ id: string } | undefined> {
		const rows = await this.db
			.select({ id: votes.id })
			.from(votes)
			.where(and(eq(votes.userId, userId), eq(votes.requestId, requestId)))
			.limit(1);
		return rows[0];
	}

	async countVotes(requestId: string): Promise<number> {
		const rows = await this.db
			.select({ voteCount: requests.voteCount })
			.from(requests)
			.where(eq(requests.id, requestId))
			.limit(1);
		return rows[0]?.voteCount ?? 0;
	}

	async findVotesForRequests(
		requestIds: string[],
		userId?: string,
	): Promise<Map<string, { voteCount: number; hasVoted: boolean }>> {
		const result = new Map<string, { voteCount: number; hasVoted: boolean }>();
		if (requestIds.length === 0) return result;

		const reqRows = await this.db
			.select({
				id: requests.id,
				voteCount: requests.voteCount,
			})
			.from(requests)
			.where(inArray(requests.id, requestIds));

		for (const row of reqRows) {
			result.set(row.id, { voteCount: row.voteCount, hasVoted: false });
		}

		if (userId) {
			const userVotes = await this.db
				.select({ requestId: votes.requestId })
				.from(votes)
				.where(and(eq(votes.userId, userId), inArray(votes.requestId, requestIds)));
			for (const uv of userVotes) {
				const entry = result.get(uv.requestId);
				if (entry) entry.hasVoted = true;
			}
		}

		for (const id of requestIds) {
			if (!result.has(id)) {
				result.set(id, { voteCount: 0, hasVoted: false });
			}
		}

		return result;
	}

	// ── Offer / Response methods ──────────────────────────────────────────

	async createOffer(
		requestId: string,
		contributorId: string,
		input: { message: string; anonymous?: boolean; modality?: string },
	): Promise<RequestResponse> {
		const rows = await this.db
			.insert(requestResponses)
			.values({
				requestId,
				contributorId,
				message: input.message,
				anonymous: input.anonymous ?? false,
				modality: (input.modality as RequestResponse['modality']) ?? null,
			})
			.returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to create offer');
		return row;
	}

	async findOfferById(id: string): Promise<RequestResponse | undefined> {
		const rows = await this.db
			.select()
			.from(requestResponses)
			.where(eq(requestResponses.id, id))
			.limit(1);
		return rows[0];
	}

	async findOfferByContributor(
		requestId: string,
		contributorId: string,
	): Promise<RequestResponse | undefined> {
		const rows = await this.db
			.select()
			.from(requestResponses)
			.where(
				and(
					eq(requestResponses.requestId, requestId),
					eq(requestResponses.contributorId, contributorId),
				),
			)
			.limit(1);
		return rows[0];
	}

	async listOffersForRequest(requestId: string): Promise<RequestResponse[]> {
		return this.db
			.select()
			.from(requestResponses)
			.where(eq(requestResponses.requestId, requestId))
			.orderBy(requestResponses.createdAt);
	}

	async listOffersByContributor(contributorId: string): Promise<RequestResponse[]> {
		return this.db
			.select()
			.from(requestResponses)
			.where(eq(requestResponses.contributorId, contributorId))
			.orderBy(requestResponses.createdAt);
	}

	async countOffersForRequest(requestId: string): Promise<number> {
		const rows = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(requestResponses)
			.where(eq(requestResponses.requestId, requestId));
		return rows[0]?.count ?? 0;
	}

	async updateOfferStatus(
		id: string,
		status: 'accepted' | 'declined' | 'withdrawn',
	): Promise<RequestResponse | undefined> {
		const rows = await this.db
			.update(requestResponses)
			.set({ status, updatedAt: new Date() })
			.where(eq(requestResponses.id, id))
			.returning();
		return rows[0];
	}

	// ── Lifecycle methods ────────────────────────────────────────────────

	async closeRequest(id: string, reason?: string): Promise<Request | undefined> {
		const rows = await this.db
			.update(requests)
			.set({
				state: 'closed',
				closedAt: new Date(),
				closedReason: reason ?? null,
				updatedAt: new Date(),
			})
			.where(eq(requests.id, id))
			.returning();
		return rows[0];
	}

	async cancelRequest(id: string): Promise<Request | undefined> {
		const rows = await this.db
			.update(requests)
			.set({
				state: 'cancelled',
				updatedAt: new Date(),
			})
			.where(eq(requests.id, id))
			.returning();
		return rows[0];
	}

	async archiveRequest(id: string): Promise<Request | undefined> {
		const rows = await this.db
			.update(requests)
			.set({
				state: 'archived',
				updatedAt: new Date(),
			})
			.where(eq(requests.id, id))
			.returning();
		return rows[0];
	}

	async listRespondersForRequest(requestId: string): Promise<string[]> {
		const rows = await this.db
			.selectDistinct({ contributorId: requestResponses.contributorId })
			.from(requestResponses)
			.where(eq(requestResponses.requestId, requestId));
		return rows.map((r) => r.contributorId);
	}
}

export function toResponse(row: Request) {
	return {
		id: row.id,
		authorId: row.authorId,
		categoryId: row.categoryId,
		title: row.title,
		goal: row.goal,
		barrier: row.barrier,
		helpNeeded: row.helpNeeded,
		state: row.state,
		modality: row.modality,
		helpType: row.helpType,
		location: row.location,
		timeCommitment: row.timeCommitment,
		duration: row.duration,
		deadline: row.deadline ? row.deadline.toISOString() : null,
		skillLevel: row.skillLevel,
		intendedOutcome: row.intendedOutcome,
		quantity: row.quantity,
		publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
		closedAt: row.closedAt ? row.closedAt.toISOString() : null,
		closedReason: row.closedReason,
		underReview: row.underReview,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export function toOfferResponse(row: RequestResponse, opts?: { hideContributor?: boolean }) {
	return {
		id: row.id,
		requestId: row.requestId,
		contributorId: opts?.hideContributor ? null : row.contributorId,
		message: row.message,
		anonymous: row.anonymous,
		modality: row.modality,
		status: row.status,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}
