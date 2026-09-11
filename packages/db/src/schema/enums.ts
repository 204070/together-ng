import { customType, pgEnum } from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', ['active', 'suspended', 'banned', 'deactivated']);

export const modality = pgEnum('modality', ['online', 'in_person', 'both']);

export const skillLevel = pgEnum('skill_level', ['beginner', 'intermediate', 'advanced']);

export const requestState = pgEnum('request_state', [
	'draft',
	'published',
	'receiving_responses',
	'help_arranged',
	'in_progress',
	'completed',
	'closed',
	'cancelled',
	'archived',
	'under_review',
]);

export const helpType = pgEnum('help_type', [
	'borrow',
	'receive',
	'access',
	'learn',
	'collaborate',
]);

export const responseStatus = pgEnum('response_status', [
	'pending',
	'accepted',
	'declined',
	'withdrawn',
]);

export const contributionStatus = pgEnum('contribution_status', [
	'accepted',
	'in_progress',
	'completed',
	'cancelled',
]);

export const outcomeResponse = pgEnum('outcome_response', [
	'yes_significantly',
	'yes_somewhat',
	'not_yet',
	'no',
]);

export const notificationType = pgEnum('notification_type', [
	'new_match',
	'request_response',
	'request_update',
	'response_accepted',
	'response_declined',
	'contribution_accepted',
	'contribution_in_progress',
	'contribution_completed',
	'confirmation_required',
	'community_interest',
	'message_received',
]);

export const digestFrequency = pgEnum('digest_frequency', ['daily', 'weekly']);

export const reportStatus = pgEnum('report_status', [
	'pending',
	'under_review',
	'resolved',
	'dismissed',
]);

export const reportSubjectType = pgEnum('report_subject_type', [
	'request',
	'profile',
	'contribution',
	'message',
	'resource',
	'resource_listing',
	'lending_agreement',
]);

export const moderationActionType = pgEnum('moderation_action_type', [
	'warning',
	'suspend',
	'restore',
	'restrict',
	'ban',
	'remove_content',
	'feature',
	'investigate',
]);

export const severity = pgEnum('severity', ['low', 'moderate', 'serious']);

export const resourceKind = pgEnum('resource_kind', [
	'book',
	'tool',
	'computer',
	'camera',
	'musical_instrument',
	'equipment',
	'educational_material',
	'other',
]);

export const resourceAvailability = pgEnum('resource_availability', [
	'given_away',
	'lent_temporarily',
	'supervised_use',
	'local_use_only',
	'remote_digital',
]);

export const resourceStatus = pgEnum('resource_status', [
	'available',
	'lent',
	'unavailable',
	'archived',
]);

export const lendingStatus = pgEnum('lending_status', [
	'requested',
	'agreed',
	'in_progress',
	'returned',
	'issue_reported',
	'disputed',
	'completed',
	'cancelled',
]);

export const conditionPhase = pgEnum('condition_phase', ['pre_handoff', 'handoff', 'return']);

export const tsvector = (name: string) =>
	customType<{ data: string; driverData: string }>({
		dataType() {
			return 'tsvector';
		},
		fromDriver(value: string): string {
			return value;
		},
	})(name);
