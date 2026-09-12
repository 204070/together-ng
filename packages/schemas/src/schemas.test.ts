import { describe, expect, test } from 'bun:test';
import { Value, ValueErrorType } from '@sinclair/typebox/value';
import {
	Category,
	ContributionCreate,
	ContributionStatus,
	OutcomeConfirmation,
	OutcomeResponse,
	Profile,
	ProfileUpdate,
	RegisterRequest,
	Request,
	RequestCreate,
	RequestResponseCreate,
	RequestState,
	ResponseStatus,
	Skill,
	UserPrivate,
	UserPublic,
	VoteCreate,
} from './index';

const validRequestId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('RegisterRequest', () => {
	const valid = { email: 'ada@example.com', password: 'password123' };

	test('accepts email and password without phone', () => {
		expect(Value.Check(RegisterRequest, valid)).toBe(true);
	});

	test('accepts an E.164 phone when present', () => {
		expect(Value.Check(RegisterRequest, { ...valid, phone: '+2348123456789' })).toBe(true);
	});

	test('rejects a missing password', () => {
		const errors = [...Value.Errors(RegisterRequest, { email: 'ada@example.com' })];
		expect(Value.Check(RegisterRequest, { email: 'ada@example.com' })).toBe(false);
		expect(errors.some((e) => e.path === '/password')).toBe(true);
	});

	test('rejects a missing email', () => {
		expect(Value.Check(RegisterRequest, { password: 'password123' })).toBe(false);
	});

	test('rejects an empty and a whitespace-only email', () => {
		expect(Value.Check(RegisterRequest, { ...valid, email: '' })).toBe(false);
		expect(Value.Check(RegisterRequest, { ...valid, email: '   ' })).toBe(false);
	});

	test('reports a format error for a malformed email', () => {
		const bad = { ...valid, email: 'not-an-email' };
		expect(Value.Check(RegisterRequest, bad)).toBe(false);
		const errors = [...Value.Errors(RegisterRequest, bad)];
		expect(errors.some((e) => e.path === '/email' && e.type === ValueErrorType.StringFormat)).toBe(
			true,
		);
	});

	test('rejects a non-E.164 phone and reports a format error', () => {
		const bad = { ...valid, phone: '08123456789' };
		expect(Value.Check(RegisterRequest, bad)).toBe(false);
		const errors = [...Value.Errors(RegisterRequest, bad)];
		expect(errors.some((e) => e.path === '/phone' && e.type === ValueErrorType.StringFormat)).toBe(
			true,
		);
	});

	test('rejects an unknown field and Value.Clean removes it', () => {
		const withExtra = { ...valid, sneaky: 'value' };
		expect(Value.Check(RegisterRequest, withExtra)).toBe(false);
		const cleaned = Value.Clean(RegisterRequest, withExtra) as Record<string, unknown>;
		expect('sneaky' in cleaned).toBe(false);
		expect(Value.Check(RegisterRequest, cleaned)).toBe(true);
	});
});

describe('private/public user split', () => {
	test('UserPrivate carries email and phone', () => {
		expect(Value.Check(UserPrivate, UserPrivateTypeValue())).toBe(true);
	});

	test('UserPublic omits email and phone at the wire level too', () => {
		const value = UserPublicTypeValue();
		expect(Value.Check(UserPublic, value)).toBe(true);
		expect('email' in value).toBe(false);
		expect('phone' in value).toBe(false);
	});
});

describe('Profile', () => {
	const valid = {
		id: validRequestId,
		userId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
		displayName: 'Ada',
		bio: null,
		location: null,
		profilePhotoKey: null,
		createdAt: '2026-09-12T10:00:00Z',
		updatedAt: '2026-09-12T10:00:00Z',
	};

	test('accepts a full profile', () => {
		expect(Value.Check(Profile, valid)).toBe(true);
	});

	test('ProfileUpdate accepts a partial update and rejects unknown fields', () => {
		expect(Value.Check(ProfileUpdate, { displayName: 'Ada Lovelace' })).toBe(true);
		expect(Value.Check(ProfileUpdate, { displayName: 'Ada', extra: 1 })).toBe(false);
	});
});

describe('RequestCreate', () => {
	const text = 'Some goal text';
	const valid = {
		title: 'Move a bookshelf',
		goal: text,
		barrier: text,
		helpNeeded: text,
		categoryId: 1,
	};

	test('accepts the required fields', () => {
		expect(Value.Check(RequestCreate, valid)).toBe(true);
	});

	test('rejects an empty or whitespace-only title', () => {
		expect(Value.Check(RequestCreate, { ...valid, title: '' })).toBe(false);
		expect(Value.Check(RequestCreate, { ...valid, title: '   ' })).toBe(false);
	});

	test('rejects a title longer than 200 chars', () => {
		expect(Value.Check(RequestCreate, { ...valid, title: 'x'.repeat(201) })).toBe(false);
		expect(Value.Check(RequestCreate, { ...valid, title: 'x'.repeat(200) })).toBe(true);
	});

	test('rejects help text longer than 2000 chars', () => {
		expect(Value.Check(RequestCreate, { ...valid, goal: 'x'.repeat(2001) })).toBe(false);
		expect(Value.Check(RequestCreate, { ...valid, goal: 'x'.repeat(2000) })).toBe(true);
	});

	test('rejects a whitespace-only goal, barrier, or helpNeeded', () => {
		expect(Value.Check(RequestCreate, { ...valid, goal: '   ' })).toBe(false);
		expect(Value.Check(RequestCreate, { ...valid, barrier: '   ' })).toBe(false);
		expect(Value.Check(RequestCreate, { ...valid, helpNeeded: '  ' })).toBe(false);
	});

	test('categoryId must be an integer >= 1', () => {
		expect(Value.Check(RequestCreate, { ...valid, categoryId: 0 })).toBe(false);
		expect(Value.Check(RequestCreate, { ...valid, categoryId: 1.5 })).toBe(false);
		expect(Value.Check(RequestCreate, { ...valid, categoryId: 1 })).toBe(true);
	});

	test('accepts the optional Section 9.6 fields', () => {
		const full = {
			...valid,
			modality: 'online',
			helpType: 'receive',
			location: 'Lagos',
			deadline: '2026-12-31T23:59:59+01:00',
			timeCommitment: '2 hours',
			duration: '1 day',
			skillLevel: 'beginner',
			quantity: '1',
			intendedOutcome: 'Learn how to repaint',
		};
		expect(Value.Check(RequestCreate, full)).toBe(true);
	});

	test('rejects a malformed deadline', () => {
		expect(Value.Check(RequestCreate, { ...valid, deadline: 'tomorrow' })).toBe(false);
	});

	test('rejects unknown fields', () => {
		expect(Value.Check(RequestCreate, { ...valid, sneaky: 1 })).toBe(false);
	});
});

describe('Request (output)', () => {
	const requestValue = {
		id: validRequestId,
		authorId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
		categoryId: 1,
		title: 'Move a bookshelf',
		goal: 'Goal text',
		barrier: 'Barrier text',
		helpNeeded: 'Help text',
		state: 'published',
		modality: null,
		helpType: null,
		location: null,
		timeCommitment: null,
		duration: null,
		deadline: null,
		skillLevel: null,
		intendedOutcome: null,
		quantity: null,
		publishedAt: null,
		closedAt: null,
		closedReason: null,
		underReview: false,
		createdAt: '2026-09-12T10:00:00Z',
		updatedAt: '2026-09-12T10:00:00Z',
	};

	test('accepts a full request', () => {
		expect(Value.Check(Request, requestValue)).toBe(true);
	});

	test('tolerates forward-compatible additional properties', () => {
		expect(Value.Check(Request, { ...requestValue, futureField: 'x' })).toBe(true);
	});
});

describe('enum schemas match DB #2 exactly', () => {
	test('RequestState has exactly the ten DB values', () => {
		const states = [
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
		];
		for (const state of states) expect(Value.Check(RequestState, state)).toBe(true);
		expect(RequestState.anyOf).toHaveLength(10);
		expect(Value.Check(RequestState, 'open')).toBe(false);
	});

	test('ResponseStatus matches the DB enum', () => {
		for (const value of ['pending', 'accepted', 'declined', 'withdrawn']) {
			expect(Value.Check(ResponseStatus, value)).toBe(true);
		}
		expect(ResponseStatus.anyOf).toHaveLength(4);
		expect(Value.Check(ResponseStatus, 'rejected')).toBe(false);
	});

	test('ContributionStatus matches the DB enum', () => {
		for (const value of ['accepted', 'in_progress', 'completed', 'cancelled']) {
			expect(Value.Check(ContributionStatus, value)).toBe(true);
		}
		expect(ContributionStatus.anyOf).toHaveLength(4);
		expect(Value.Check(ContributionStatus, 'pending')).toBe(false);
	});

	test('OutcomeResponse matches the four Section 21 options', () => {
		for (const value of ['yes_significantly', 'yes_somewhat', 'not_yet', 'no']) {
			expect(Value.Check(OutcomeResponse, value)).toBe(true);
		}
		expect(OutcomeResponse.anyOf).toHaveLength(4);
		expect(Value.Check(OutcomeResponse, 'maybe')).toBe(false);
	});
});

describe('Category and Skill', () => {
	const categoryValue = {
		id: 1,
		name: 'Education',
		slug: 'education',
		description: null,
		parentId: null,
		retiredAt: null,
		createdAt: '2026-09-12T10:00:00Z',
		updatedAt: '2026-09-12T10:00:00Z',
	};

	const skillValue = {
		id: 1,
		categoryId: 1,
		name: 'Maths tutoring',
		slug: 'maths-tutoring',
		retiredAt: null,
		createdAt: '2026-09-12T10:00:00Z',
		updatedAt: '2026-09-12T10:00:00Z',
	};

	test('accepts active and retired taxonomy entries', () => {
		expect(Value.Check(Category, categoryValue)).toBe(true);
		expect(Value.Check(Category, { ...categoryValue, retiredAt: '2026-01-01T00:00:00Z' })).toBe(
			true,
		);
		expect(Value.Check(Skill, skillValue)).toBe(true);
		expect(Value.Check(Skill, { ...skillValue, retiredAt: '2026-01-01T00:00:00Z' })).toBe(true);
	});

	test('rejects a non-date-time retiredAt', () => {
		expect(Value.Check(Category, { ...categoryValue, retiredAt: '2026-01-01' })).toBe(false);
		expect(Value.Check(Skill, { ...skillValue, retiredAt: false })).toBe(false);
	});
});

describe('remaining input schemas', () => {
	test('RequestResponseCreate', () => {
		expect(
			Value.Check(RequestResponseCreate, { requestId: validRequestId, message: 'I can help' }),
		).toBe(true);
		expect(Value.Check(RequestResponseCreate, { requestId: validRequestId, message: '' })).toBe(
			false,
		);
		expect(Value.Check(RequestResponseCreate, { message: 'I can help' })).toBe(false);
		expect(
			Value.Check(RequestResponseCreate, {
				requestId: validRequestId,
				message: 'In person',
				modality: 'both',
			}),
		).toBe(true);
	});

	test('ContributionCreate', () => {
		expect(Value.Check(ContributionCreate, { requestId: validRequestId })).toBe(true);
		expect(
			Value.Check(ContributionCreate, { requestId: validRequestId, responseId: validRequestId }),
		).toBe(true);
		expect(Value.Check(ContributionCreate, {})).toBe(false);
	});

	test('VoteCreate', () => {
		expect(Value.Check(VoteCreate, { requestId: validRequestId })).toBe(true);
		expect(Value.Check(VoteCreate, {})).toBe(false);
		expect(Value.Check(VoteCreate, { requestId: 'not-a-uuid' })).toBe(false);
	});

	test('OutcomeConfirmation', () => {
		const value = {
			id: validRequestId,
			contributionId: validRequestId,
			recipientId: validRequestId,
			response: 'yes_somewhat',
			explanation: null,
			createdAt: '2026-09-12T10:00:00Z',
		};
		expect(Value.Check(OutcomeConfirmation, value)).toBe(true);
		expect(Value.Check(OutcomeConfirmation, { ...value, response: 'maybe' })).toBe(false);
	});
});

function UserPrivateTypeValue() {
	return {
		id: validRequestId,
		email: 'ada@example.com',
		emailVerified: true,
		phone: null,
		phoneVerified: false,
		status: 'active',
		lastLoginAt: null,
		deletedAt: null,
		createdAt: '2026-09-12T10:00:00Z',
		updatedAt: '2026-09-12T10:00:00Z',
	};
}

function UserPublicTypeValue() {
	return {
		id: validRequestId,
		status: 'active',
		createdAt: '2026-09-12T10:00:00Z',
		updatedAt: '2026-09-12T10:00:00Z',
	};
}
