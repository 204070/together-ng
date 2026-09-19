import { describe, expect, test } from 'vitest';
import { cardImageUrlFor, shareContentFor } from '../components/share/canonical';
import { Route } from '../routes/requests/$requestId';

const SITE = 'http://localhost:5032';

function headFn() {
	const fn = Route.options.head;
	if (!fn) throw new Error('Route head function missing');
	return fn;
}

function metaContent(meta: unknown[], key: string): string | undefined {
	for (const entry of meta as Record<string, unknown>[]) {
		if (entry.property === key || entry.name === key) return entry.content as string;
	}
	return undefined;
}

describe('requests/$requestId route head metadata', () => {
	test('generates absolute OpenGraph and Twitter metadata for a published request', async () => {
		const result = await headFn()({
			loaderData: {
				request: {
					id: 'req-456',
					title: 'Urgent Medical Supplies',
					goal: 'Deliver first aid packages to rural clinic',
					state: 'published',
				},
				siteUrl: SITE,
			},
			params: { requestId: 'req-456' },
		} as never);

		const meta = result?.meta ?? [];

		expect(meta).toContainEqual({ title: 'Urgent Medical Supplies | Together' });
		expect(meta).toContainEqual({
			name: 'description',
			content: 'Deliver first aid packages to rural clinic',
		});
		expect(meta).toContainEqual({ property: 'og:title', content: 'Urgent Medical Supplies' });
		expect(meta).toContainEqual({
			property: 'og:description',
			content: 'Deliver first aid packages to rural clinic',
		});
		expect(meta).toContainEqual({ property: 'og:type', content: 'website' });
		// og:url equals the absolute canonical URL.
		expect(meta).toContainEqual({
			property: 'og:url',
			content: `${SITE}/requests/req-456`,
		});
		// og:image is the servable generic fallback card until the pipeline (#33/#34) owns it.
		expect(meta).toContainEqual({
			property: 'og:image',
			content: `${SITE}/images/share-fallback.png`,
		});
		expect(meta).toContainEqual({ property: 'og:image:width', content: '1200' });
		expect(meta).toContainEqual({ property: 'og:image:height', content: '630' });
		expect(meta).toContainEqual({ property: 'og:image:alt', content: 'Urgent Medical Supplies' });
		expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' });
		expect(meta).toContainEqual({ name: 'twitter:title', content: 'Urgent Medical Supplies' });
		expect(meta).toContainEqual({
			name: 'twitter:description',
			content: 'Deliver first aid packages to rural clinic',
		});
		expect(meta).toContainEqual({
			name: 'twitter:image',
			content: `${SITE}/images/share-fallback.png`,
		});

		// Every og: tag is non-empty (curl | grep og: check).
		for (const entry of meta as Record<string, unknown>[]) {
			if (typeof entry.property === 'string' && entry.property.startsWith('og:')) {
				expect(typeof entry.content === 'string' && entry.content.length > 0).toBe(true);
			}
		}
	});

	test('og tags derive from the same source of truth as the page and track title edits', async () => {
		const edited = {
			id: 'req-456',
			title: 'Edited Title After Update',
			goal: 'Deliver first aid packages to rural clinic',
			state: 'published',
		};
		const result = await headFn()({
			loaderData: { request: edited, siteUrl: SITE },
			params: { requestId: 'req-456' },
		} as never);
		const meta = result?.meta ?? [];
		const expected = shareContentFor({ ...edited });
		expect(metaContent(meta, 'og:title')).toBe(expected.title);
		expect(metaContent(meta, 'og:description')).toBe(expected.description);
		expect(meta).toContainEqual({ title: `${expected.title} | Together` });
	});

	test('truncates long goal summaries in og:description', async () => {
		const goal = `${'a'.repeat(150)} ${'b'.repeat(150)}`;
		const result = await headFn()({
			loaderData: {
				request: { id: 'req-1', title: 'T', goal, state: 'published' },
				siteUrl: SITE,
			},
			params: { requestId: 'req-1' },
		} as never);
		const description = metaContent(result?.meta ?? [], 'og:description');
		expect(description).toBe(
			shareContentFor({ id: 'req-1', title: 'T', goal, state: '' }).description,
		);
		expect(typeof description === 'string' && description.length <= 200).toBe(true);
	});

	test('falls back to relative canonical URLs when the site origin is unknown', async () => {
		const result = await headFn()({
			loaderData: {
				request: { id: 'req-9', title: 'T', goal: 'G', state: 'published' },
				siteUrl: undefined,
			},
			params: { requestId: 'req-9' },
		} as never);
		const meta = result?.meta ?? [];
		expect(metaContent(meta, 'og:url')).toBe('/requests/req-9');
		expect(metaContent(meta, 'og:image')).toBe(cardImageUrlFor({ requestId: 'req-9' }));
	});

	test('generates generic noindex fallback metadata when request is null', async () => {
		const result = await headFn()({
			loaderData: { request: null, siteUrl: SITE },
			params: { requestId: 'req-missing' },
		} as never);

		const meta = result?.meta ?? [];

		expect(meta).toContainEqual({ title: 'Request not found | Together' });
		expect(meta).toContainEqual({ name: 'robots', content: 'noindex' });
		expect(metaContent(meta, 'og:title')).toBe('Together');
		expect(metaContent(meta, 'og:url')).toBe(`${SITE}/requests/req-missing`);
		// Fallback metadata never carries the request's own title/description.
		const serialized = JSON.stringify(meta);
		expect(serialized).not.toContain('Secret Draft Title');
	});
});
