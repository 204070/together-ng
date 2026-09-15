import { describe, expect, test } from 'vitest';
import { Route } from '../routes/requests/$requestId';

describe('requests/$requestId route head metadata', () => {
	test('generates OpenGraph and Twitter metadata for valid request', async () => {
		const headFn = Route.options.head;
		expect(headFn).toBeDefined();
		if (!headFn) throw new Error('Route head function missing');

		const result = await headFn({
			loaderData: {
				request: {
					id: 'req-456',
					title: 'Urgent Medical Supplies',
					goal: 'Deliver first aid packages to rural clinic',
				},
			},
			params: { requestId: 'req-456' },
		} as never);

		const meta = result?.meta ?? [];

		expect(meta).toContainEqual({ title: 'Urgent Medical Supplies | Together' });
		expect(meta).toContainEqual({
			name: 'description',
			content: 'Deliver first aid packages to rural clinic',
		});
		expect(meta).toContainEqual({
			property: 'og:title',
			content: 'Urgent Medical Supplies',
		});
		expect(meta).toContainEqual({
			property: 'og:description',
			content: 'Deliver first aid packages to rural clinic',
		});
		expect(meta).toContainEqual({
			property: 'og:type',
			content: 'website',
		});
		expect(meta).toContainEqual({
			property: 'og:url',
			content: '/requests/req-456',
		});
		expect(meta).toContainEqual({
			property: 'og:image',
			content: '/api/requests/req-456/card.png',
		});
		expect(meta).toContainEqual({
			property: 'og:image:width',
			content: '1200',
		});
		expect(meta).toContainEqual({
			property: 'og:image:height',
			content: '630',
		});
		expect(meta).toContainEqual({
			property: 'og:image:alt',
			content: 'Urgent Medical Supplies',
		});
		expect(meta).toContainEqual({
			name: 'twitter:card',
			content: 'summary_large_image',
		});
		expect(meta).toContainEqual({
			name: 'twitter:title',
			content: 'Urgent Medical Supplies',
		});
		expect(meta).toContainEqual({
			name: 'twitter:description',
			content: 'Deliver first aid packages to rural clinic',
		});
		expect(meta).toContainEqual({
			name: 'twitter:image',
			content: '/api/requests/req-456/card.png',
		});
	});

	test('generates noindex fallback metadata when request is null', async () => {
		const headFn = Route.options.head;
		expect(headFn).toBeDefined();
		if (!headFn) throw new Error('Route head function missing');

		const result = await headFn({
			loaderData: { request: null },
			params: { requestId: 'req-missing' },
		} as never);

		const meta = result?.meta ?? [];

		expect(meta).toContainEqual({ title: 'Request not found | Together' });
		expect(meta).toContainEqual({ name: 'robots', content: 'noindex' });
	});
});
