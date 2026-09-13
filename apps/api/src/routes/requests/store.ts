import type { Sql } from '@together/db';
export interface RequestRow {
	id: string;
	author_id: string;
	category_id: number | null;
	title: string;
	goal: string;
	barrier: string;
	help_needed: string;
	state: string;
	modality: string | null;
	help_type: string | null;
	location: string | null;
	time_commitment: string | null;
	duration: string | null;
	deadline: Date | null;
	skill_level: string | null;
	intended_outcome: string | null;
	quantity: string | null;
	published_at: Date | null;
	closed_at: Date | null;
	closed_reason: string | null;
	under_review: boolean;
	search_vector?: string | null;
	created_at: Date;
	updated_at: Date;
}
export interface CategoryRow {
	id: number;
	slug: string;
	retired_at: Date | null;
}
export class RequestStore {
	constructor(private readonly sql: Sql) {}
	async findCategoryById(id: number): Promise<CategoryRow | undefined> {
		const rows = await this.sql<
			CategoryRow[]
		>`SELECT id, slug, retired_at FROM categories WHERE id = ${id}`;
		return rows[0];
	}
	async createRequest(authorId: string, input: Record<string, unknown>): Promise<RequestRow> {
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
		const rows = await this.sql<
			RequestRow[]
		>`INSERT INTO requests (author_id, category_id, title, goal, barrier, help_needed, state, modality, help_type, location, time_commitment, duration, deadline, skill_level, intended_outcome, quantity) VALUES (${authorId}, ${categoryId}, ${title}, ${goal}, ${barrier}, ${helpNeeded}, 'draft', ${modality}, ${helpType}, ${location}, ${timeCommitment}, ${duration}, ${deadline}, ${skillLevel}, ${intendedOutcome}, ${quantity}) RETURNING id, author_id, category_id, title, goal, barrier, help_needed, state, modality, help_type, location, time_commitment, duration, deadline, skill_level, intended_outcome, quantity, published_at, closed_at, closed_reason, under_review, created_at, updated_at`;
		return rows[0] as RequestRow;
	}
	async findRequestById(id: string): Promise<RequestRow | undefined> {
		const rows = await this.sql<
			RequestRow[]
		>`SELECT id, author_id, category_id, title, goal, barrier, help_needed, state, modality, help_type, location, time_commitment, duration, deadline, skill_level, intended_outcome, quantity, published_at, closed_at, closed_reason, under_review, created_at, updated_at FROM requests WHERE id = ${id}`;
		return rows[0];
	}
	async updateRequest(id: string, patch: Record<string, unknown>): Promise<RequestRow | undefined> {
		const existing = await this.findRequestById(id);
		if (!existing) return undefined;
		const next = {
			title: (patch.title as string | undefined) ?? existing.title,
			goal: (patch.goal as string | undefined) ?? existing.goal,
			barrier: (patch.barrier as string | undefined) ?? existing.barrier,
			help_needed: (patch.helpNeeded as string | undefined) ?? existing.help_needed,
			category_id:
				patch.categoryId !== undefined ? (patch.categoryId as number | null) : existing.category_id,
			modality:
				patch.modality !== undefined ? (patch.modality as string | null) : existing.modality,
			help_type:
				patch.helpType !== undefined ? (patch.helpType as string | null) : existing.help_type,
			location:
				patch.location !== undefined ? (patch.location as string | null) : existing.location,
			time_commitment:
				patch.timeCommitment !== undefined
					? (patch.timeCommitment as string | null)
					: existing.time_commitment,
			duration:
				patch.duration !== undefined ? (patch.duration as string | null) : existing.duration,
			deadline:
				patch.deadline !== undefined
					? patch.deadline
						? new Date(patch.deadline as string)
						: null
					: existing.deadline,
			skill_level:
				patch.skillLevel !== undefined ? (patch.skillLevel as string | null) : existing.skill_level,
			intended_outcome:
				patch.intendedOutcome !== undefined
					? (patch.intendedOutcome as string | null)
					: existing.intended_outcome,
			quantity:
				patch.quantity !== undefined ? (patch.quantity as string | null) : existing.quantity,
		};
		const rows = await this.sql<
			RequestRow[]
		>`UPDATE requests SET title=${next.title}, goal=${next.goal}, barrier=${next.barrier}, help_needed=${next.help_needed}, category_id=${next.category_id}, modality=${next.modality}, help_type=${next.help_type}, location=${next.location}, time_commitment=${next.time_commitment}, duration=${next.duration}, deadline=${next.deadline}, skill_level=${next.skill_level}, intended_outcome=${next.intended_outcome}, quantity=${next.quantity}, updated_at=now() WHERE id=${id} RETURNING id, author_id, category_id, title, goal, barrier, help_needed, state, modality, help_type, location, time_commitment, duration, deadline, skill_level, intended_outcome, quantity, published_at, closed_at, closed_reason, under_review, created_at, updated_at`;
		return rows[0];
	}
	async publishRequest(id: string): Promise<RequestRow | undefined> {
		const rows = await this.sql<
			RequestRow[]
		>`UPDATE requests SET state='published', published_at=now(), updated_at=now() WHERE id=${id} RETURNING id, author_id, category_id, title, goal, barrier, help_needed, state, modality, help_type, location, time_commitment, duration, deadline, skill_level, intended_outcome, quantity, published_at, closed_at, closed_reason, under_review, created_at, updated_at`;
		return rows[0];
	}
}
export function toResponse(row: RequestRow) {
	return {
		id: row.id,
		authorId: row.author_id,
		categoryId: row.category_id,
		title: row.title,
		goal: row.goal,
		barrier: row.barrier,
		helpNeeded: row.help_needed,
		state: row.state,
		modality: row.modality,
		helpType: row.help_type,
		location: row.location,
		timeCommitment: row.time_commitment,
		duration: row.duration,
		deadline: row.deadline ? row.deadline.toISOString() : null,
		skillLevel: row.skill_level,
		intendedOutcome: row.intended_outcome,
		quantity: row.quantity,
		publishedAt: row.published_at ? row.published_at.toISOString() : null,
		closedAt: row.closed_at ? row.closed_at.toISOString() : null,
		closedReason: row.closed_reason,
		underReview: row.under_review,
		createdAt: row.created_at.toISOString(),
		updatedAt: row.updated_at.toISOString(),
	};
}
