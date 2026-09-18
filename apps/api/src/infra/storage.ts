import type { S3Client, S3Options } from 'bun';
import { getApiConfig } from '../config';

export interface FileStorage {
	put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
	get(key: string): Promise<Uint8Array | null>;
	delete(key: string): Promise<void>;
	publicUrl(key: string): string;
	exists?(key: string): Promise<boolean>;
}

export class MockFileStorage implements FileStorage {
	private readonly store = new Map<string, { bytes: Uint8Array; contentType: string }>();

	async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
		this.store.set(key, { bytes, contentType });
	}

	async get(key: string): Promise<Uint8Array | null> {
		const entry = this.store.get(key);
		return entry ? entry.bytes : null;
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	async exists(key: string): Promise<boolean> {
		return this.store.has(key);
	}

	publicUrl(key: string): string {
		const cleanKey = key.replace(/^\/+/, '');
		return `https://mock.storage/${cleanKey}`;
	}

	// Test helpers
	getEntry(key: string): { bytes: Uint8Array; contentType: string } | undefined {
		return this.store.get(key);
	}

	clear(): void {
		this.store.clear();
	}
}

export interface BunS3StorageConfig {
	bucket: string;
	endpoint?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
	sessionToken?: string;
	region?: string;
	publicUrlBase?: string;
	acl?: S3Options['acl'];
	client?: S3Client;
}

export class BunS3FileStorage implements FileStorage {
	private readonly client: S3Client;
	private readonly bucket: string;
	private readonly endpoint?: string;
	private readonly region?: string;
	private readonly publicUrlBase?: string;
	private readonly acl?: S3Options['acl'];

	constructor(config: BunS3StorageConfig) {
		this.bucket = config.bucket;
		this.endpoint = config.endpoint;
		this.region = config.region;
		this.publicUrlBase = config.publicUrlBase;
		this.acl = config.acl;

		this.client =
			config.client ??
			new Bun.S3Client({
				bucket: config.bucket,
				endpoint: config.endpoint,
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
				sessionToken: config.sessionToken,
				region: config.region,
				acl: config.acl,
			});
	}

	async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
		const options: S3Options = {
			type: contentType,
			...(this.acl ? { acl: this.acl } : {}),
		};

		if (typeof this.client.write === 'function') {
			await this.client.write(key, bytes, options);
		} else if (typeof this.client.file === 'function') {
			const file = this.client.file(key);
			await file.write(bytes, options);
		}
	}

	async get(key: string): Promise<Uint8Array | null> {
		try {
			if (typeof this.client.file !== 'function') {
				return null;
			}
			const file = this.client.file(key);
			const exists = await file.exists();
			if (!exists) {
				return null;
			}
			const arrayBuffer = await file.arrayBuffer();
			return new Uint8Array(arrayBuffer);
		} catch {
			return null;
		}
	}

	async delete(key: string): Promise<void> {
		if (typeof this.client.delete === 'function') {
			await this.client.delete(key);
		} else if (typeof this.client.file === 'function') {
			const file = this.client.file(key);
			if (typeof file.delete === 'function') {
				await file.delete();
			}
		}
	}

	async exists(key: string): Promise<boolean> {
		if (typeof this.client.file === 'function') {
			const file = this.client.file(key);
			return await file.exists();
		}
		return false;
	}

	publicUrl(key: string): string {
		const cleanKey = key.replace(/^\/+/, '');
		if (this.publicUrlBase) {
			const base = this.publicUrlBase.replace(/\/+$/, '');
			return `${base}/${cleanKey}`;
		}
		if (this.endpoint) {
			const base = this.endpoint.replace(/\/+$/, '');
			return this.bucket ? `${base}/${this.bucket}/${cleanKey}` : `${base}/${cleanKey}`;
		}
		if (this.bucket) {
			const host =
				this.region && this.region !== 'us-east-1'
					? `${this.bucket}.s3.${this.region}.amazonaws.com`
					: `${this.bucket}.s3.amazonaws.com`;
			return `https://${host}/${cleanKey}`;
		}
		return `/${cleanKey}`;
	}
}

export function createFileStorage(): FileStorage {
	const config = getApiConfig().storage;

	if (config.provider === 's3') {
		return new BunS3FileStorage({
			bucket: config.bucket,
			endpoint: config.endpoint,
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
			sessionToken: config.sessionToken,
			region: config.region,
			publicUrlBase: config.publicUrl,
		});
	}

	return new MockFileStorage();
}

export function buildFileKey(prefix: string, entityId: string, extOrFilename?: string): string {
	const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
	const cleanEntityId = entityId.replace(/^\/+|\/+$/g, '');
	const id = crypto.randomUUID();
	if (!extOrFilename) {
		return `${cleanPrefix}/${cleanEntityId}/${id}`;
	}
	const ext = extOrFilename.startsWith('.')
		? extOrFilename
		: extOrFilename.includes('.')
			? `.${extOrFilename.split('.').pop()}`
			: `.${extOrFilename}`;
	return `${cleanPrefix}/${cleanEntityId}/${id}${ext}`;
}

export function buildPhotoKey(userId: string, ext: string = 'jpg'): string {
	const cleanExt = ext.replace(/^\.+/, '');
	return `photos/${userId}/${crypto.randomUUID()}.${cleanExt}`;
}

export function buildAttachmentKey(entityId: string, filename?: string): string {
	return buildFileKey('attachments', entityId, filename);
}

export function buildConditionPhotoKey(recordId: string, ext: string = 'jpg'): string {
	const cleanExt = ext.replace(/^\.+/, '');
	return `conditions/${recordId}/${crypto.randomUUID()}.${cleanExt}`;
}

export const fileStorage: FileStorage = createFileStorage();
