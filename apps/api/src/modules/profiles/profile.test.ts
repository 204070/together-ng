import { describe, expect, test } from 'bun:test';

describe('profiles storage boundary', () => {
	test('mock storage round-trips', async () => {
		const { MockFileStorage, buildPhotoKey } = await import('../../infra/storage');
		const storage = new MockFileStorage();
		const key = buildPhotoKey('user-1');
		expect(key).toMatch(/^photos\/user-1\/.+\.jpg$/);
		await storage.put(key, new Uint8Array([1, 2, 3]), 'image/jpeg');
		expect(storage.publicUrl(key)).toContain(key);
	});
});
