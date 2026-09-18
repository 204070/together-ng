import type {
	ContributionComplete,
	ContributionConfirm,
	OutcomeSubmit,
	Static,
} from '@together/schemas';
import type { NewNotification } from '../../infra/database';
import { HttpError } from '../../lib/errors';
import type { NotificationService } from '../notifications/services';
import { type ContributionStore, toContributionResponse } from './store';

const VALID_STATUSES_FOR_COMPLETE = new Set(['in_progress']);
const VALID_STATUSES_FOR_CONFIRM = new Set(['completed']);
const VALID_STATUSES_FOR_OUTCOME = new Set(['completed']);

function notFound(message = 'Contribution not found'): HttpError {
	return new HttpError(404, 'NOT_FOUND', undefined, undefined, message);
}

function notParticipant(): HttpError {
	return new HttpError(
		403,
		'NOT_PARTICIPANT',
		undefined,
		undefined,
		'Not a participant in this contribution',
	);
}

function cannotConfirmOwnCompletion(): HttpError {
	return new HttpError(
		403,
		'CANNOT_CONFIRM_OWN_COMPLETION',
		undefined,
		undefined,
		'Cannot confirm your own completion',
	);
}

function cannotSubmitOwnOutcome(): HttpError {
	return new HttpError(
		403,
		'CANNOT_SUBMIT_OWN_OUTCOME',
		undefined,
		undefined,
		'Only the recipient can submit outcome confirmation',
	);
}

function invalidStatusForAction(action: string, status: string): HttpError {
	return new HttpError(
		422,
		'INVALID_STATUS',
		{ status, action },
		undefined,
		`Contribution cannot be ${action} in this status`,
	);
}

function alreadyConfirmed(): HttpError {
	return new HttpError(
		409,
		'ALREADY_CONFIRMED',
		undefined,
		undefined,
		'Completion already confirmed',
	);
}

function alreadySubmittedOutcome(): HttpError {
	return new HttpError(
		409,
		'OUTCOME_ALREADY_SUBMITTED',
		undefined,
		undefined,
		'Outcome already submitted',
	);
}

export class ContributionService {
	constructor(
		public readonly store: ContributionStore,
		public readonly notifications: NotificationService,
	) {}

	private async sendNotification(entry: {
		userId: string;
		requestId: string;
		type: NewNotification['type'];
		title: string;
		body: string;
		data?: Record<string, unknown>;
	}) {
		await this.notifications.send({
			userId: entry.userId,
			requestId: entry.requestId,
			type: entry.type,
			title: entry.title,
			body: entry.body,
			data: entry.data,
		});
	}

	async getContribution(contributionId: string, actorUserId?: string) {
		const result = await this.store.findContributionWithRequest(contributionId);
		if (!result) throw notFound();

		const isParticipant =
			Boolean(actorUserId) &&
			(result.contributorId === actorUserId || result.requestAuthorId === actorUserId);

		const resp = toContributionResponse(result);
		if (!isParticipant) {
			return {
				...resp,
				contributorId: null,
			};
		}
		return resp;
	}

	async completeContribution(
		contributionId: string,
		userId: string,
		b: Static<typeof ContributionComplete>,
	) {
		const result = await this.store.findContributionWithRequest(contributionId);
		if (!result) throw notFound();

		const isParticipant = result.contributorId === userId || result.requestAuthorId === userId;
		if (!isParticipant) throw notParticipant();

		if (!VALID_STATUSES_FOR_COMPLETE.has(result.status)) {
			throw invalidStatusForAction('completed', result.status);
		}

		const updated = await this.store.updateContributionStatus(contributionId, 'completed', {
			completedAt: new Date(),
			notes: (b.notes as string | null) ?? undefined,
		});
		if (!updated) throw notFound();

		const notifyUserId =
			result.contributorId === userId ? result.requestAuthorId : result.contributorId;
		await this.sendNotification({
			userId: notifyUserId,
			requestId: result.requestId,
			type: 'contribution_completed',
			title: 'Contribution completed',
			body: 'A contribution has been marked as completed. Please confirm.',
			data: { contributionId },
		});

		return toContributionResponse(updated);
	}

	async confirmContribution(
		contributionId: string,
		userId: string,
		b: Static<typeof ContributionConfirm>,
	) {
		const result = await this.store.findContributionWithRequest(contributionId);
		if (!result) throw notFound();

		const isParticipant = result.contributorId === userId || result.requestAuthorId === userId;
		if (!isParticipant) throw notParticipant();

		if (result.contributorId === userId) {
			throw cannotConfirmOwnCompletion();
		}

		if (!VALID_STATUSES_FOR_CONFIRM.has(result.status)) {
			throw invalidStatusForAction('confirmed', result.status);
		}

		const existing = await this.store.findContributorConfirmation(contributionId);
		if (existing) throw alreadyConfirmed();

		const confirmation = await this.store.createContributorConfirmation(
			contributionId,
			result.contributorId,
			b.completedAsAgreed,
		);

		await this.sendNotification({
			userId: result.contributorId,
			requestId: result.requestId,
			type: 'confirmation_required',
			title: 'Completion confirmed',
			body: 'Your completion has been confirmed.',
			data: { contributionId },
		});

		return {
			id: confirmation.id,
			contributionId: confirmation.contributionId,
			contributorId: confirmation.contributorId,
			completedAsAgreed: confirmation.completedAsAgreed,
			createdAt: confirmation.createdAt.toISOString(),
		};
	}

	async submitOutcome(contributionId: string, userId: string, b: Static<typeof OutcomeSubmit>) {
		const result = await this.store.findContributionWithRequest(contributionId);
		if (!result) throw notFound();

		if (result.requestAuthorId !== userId) {
			throw cannotSubmitOwnOutcome();
		}

		if (!VALID_STATUSES_FOR_OUTCOME.has(result.status)) {
			throw invalidStatusForAction('outcome-submitted', result.status);
		}

		const existing = await this.store.findOutcomeConfirmation(contributionId);
		if (existing) throw alreadySubmittedOutcome();

		const confirmation = await this.store.createOutcomeConfirmation(
			contributionId,
			userId,
			true,
			b.response,
			b.explanation ?? undefined,
		);

		await this.sendNotification({
			userId: result.contributorId,
			requestId: result.requestId,
			type: 'contribution_accepted',
			title: 'Outcome recorded',
			body: 'The recipient has recorded the outcome of your contribution.',
			data: { contributionId, response: b.response },
		});

		return {
			id: confirmation.id,
			contributionId: confirmation.contributionId,
			recipientId: confirmation.recipientId,
			received: confirmation.received,
			response: confirmation.response,
			explanation: confirmation.explanation,
			createdAt: confirmation.createdAt.toISOString(),
		};
	}
}

export function createContributionService(
	store: ContributionStore,
	notifications: NotificationService,
): ContributionService {
	return new ContributionService(store, notifications);
}

export const createContributionServices = createContributionService;
