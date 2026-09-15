import { describe, expect, test } from 'bun:test';
import { missingFields, qualityHints } from './quality';
import { canTransition } from './state';

describe('qualityHints', () => {
	test('vague laptop goal returns laptop hint', () => {
		expect(qualityHints({ goal: 'I need a laptop' })).toContain(
			'What are you trying to do with the laptop?',
		);
	});
	test('specific goal returns no hint', () => {
		expect(
			qualityHints({
				goal: 'I am trying to learn electronics and build my first simple circuit with Arduino',
				barrier: 'I understand theory but need practical guidance from experienced person',
				helpNeeded: 'Someone experienced with basic electronics who can guide me',
			}),
		).toEqual([]);
	});
	test('empty goal shows missing hint', () => {
		expect(qualityHints({})).toContain('Add a goal: what are you trying to accomplish?');
	});
});
describe('missingFields', () => {
	test('empty input reports all required fields', () => {
		expect(
			missingFields({ title: '', goal: '', barrier: '', helpNeeded: '', categoryId: null }),
		).toEqual(['title', 'goal', 'barrier', 'helpNeeded', 'categoryId']);
	});
	test('filled input reports none', () => {
		expect(
			missingFields({ title: 't', goal: 'g', barrier: 'b', helpNeeded: 'h', categoryId: 1 }),
		).toEqual([]);
	});
});
describe('state machine', () => {
	test('draft can go to published', () => {
		expect(canTransition('draft', 'published')).toBe(true);
	});
	test('published cannot go to draft', () => {
		expect(canTransition('published', 'draft')).toBe(false);
	});
	test('draft cannot go directly to completed', () => {
		expect(canTransition('draft', 'completed')).toBe(false);
	});
});
describe('toResponse', () => {
	test('does not expose searchVector', async () => {
		const { toResponse } = await import('./store');
		const row = {
			id: '00000000-0000-0000-0000-000000000001',
			authorId: '00000000-0000-0000-0000-000000000002',
			categoryId: 1,
			title: 't',
			goal: 'g',
			barrier: 'b',
			helpNeeded: 'h',
			state: 'draft',
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
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			updatedAt: new Date('2026-01-01T00:00:00.000Z'),
			searchVector: "'test':1",
		} as never;
		expect(toResponse(row as never)).not.toHaveProperty('searchVector');
		expect(toResponse(row as never)).not.toHaveProperty('search_vector');
		// also ensure stripping works even if row carries search_vector
		const res = toResponse(row as never) as Record<string, unknown>;
		expect('searchVector' in res).toBe(false);
	});
	test('returns wire shape without leaking DB internals', async () => {
		const { toResponse } = await import('./store');
		const row = {
			id: '00000000-0000-0000-0000-000000000001',
			authorId: '00000000-0000-0000-0000-000000000002',
			categoryId: 1,
			title: 'title',
			goal: 'goal',
			barrier: 'barrier',
			helpNeeded: 'help',
			state: 'draft',
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
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			updatedAt: new Date('2026-01-01T00:00:00.000Z'),
		} as never;
		const res = toResponse(row as never) as Record<string, unknown>;
		expect(Object.keys(res).sort()).toEqual(
			[
				'authorId',
				'barrier',
				'categoryId',
				'closedAt',
				'closedReason',
				'createdAt',
				'deadline',
				'duration',
				'goal',
				'helpNeeded',
				'helpType',
				'id',
				'intendedOutcome',
				'location',
				'modality',
				'publishedAt',
				'quantity',
				'skillLevel',
				'state',
				'timeCommitment',
				'title',
				'underReview',
				'updatedAt',
			].sort(),
		);
	});
});
