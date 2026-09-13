export interface PhotoStorage {
	put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
	publicUrl(key: string): string;
}

export class MockPhotoStorage implements PhotoStorage {
	private readonly store = new Map<string, { bytes: Uint8Array; contentType: string }>();

	async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
		this.store.set(key, { bytes, contentType });
	}

	publicUrl(key: string): string {
		return `https://mock.storage/${key}`;
	}

	// test helper
	get(key: string): { bytes: Uint8Array; contentType: string } | undefined {
		return this.store.get(key);
	}

	clear(): void {
		this.store.clear();
	}
}

export class S3CompatiblePhotoStorage implements PhotoStorage {
	constructor(
		private readonly baseUrl: string,
		private readonly bucket: string,
	) {}

	async put(_key: string, _bytes: Uint8Array, _contentType: string): Promise<void> {
		// Production: PUT to S3-compatible endpoint (R2/B2). Kept behind interface for D17.
		// Real implementation would use AWS SDK; stub throws if called without config.
		throw new Error('S3 storage not configured — use MockPhotoStorage in test/dev');
	}

	publicUrl(key: string): string {
		const base = this.baseUrl.replace(/\/$/, '');
		return `${base}/${this.bucket}/${key}`;
	}
}

export function buildPhotoKey(userId: string): string {
	return `photos/${userId}/${crypto.randomUUID()}.jpg`;
}

export const photoStorage: PhotoStorage = new MockPhotoStorage();
