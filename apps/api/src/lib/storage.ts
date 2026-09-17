import { env as configEnv } from '@together/config';
import type { S3Client, S3Options } from 'bun';

export interface FileStorage {
	put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
	get(key: string): Promise<Uint8Array | null>;
	delete(key: string): Promise<void>;
	publicUrl(key: string): string;
	exists?(key: string): Promise<boolean>;
}

// Backwards compatibility alias for profiles module
export type PhotoStorage = FileStorage;

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

// Backwards compatibility alias
export const MockPhotoStorage = MockFileStorage;
export type MockPhotoStorage = MockFileStorage;

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

export interface FileStorageOptions {
	provider?: 's3' | 'mock';
	bucket?: string;
	endpoint?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
	sessionToken?: string;
	region?: string;
	publicUrlBase?: string;
	acl?: S3Options['acl'];
	client?: S3Client;
}

export function createFileStorage(options: FileStorageOptions = {}): FileStorage {
	const provider =
		options.provider ?? process.env.STORAGE_PROVIDER ?? configEnv?.STORAGE_PROVIDER ?? 'mock';

	if (provider === 's3') {
		const bucket =
			options.bucket ??
			process.env.STORAGE_BUCKET ??
			configEnv?.STORAGE_BUCKET ??
			process.env.S3_BUCKET ??
			process.env.AWS_BUCKET ??
			'';
		const endpoint =
			options.endpoint ??
			process.env.STORAGE_ENDPOINT ??
			configEnv?.STORAGE_ENDPOINT ??
			process.env.S3_ENDPOINT ??
			process.env.AWS_ENDPOINT;
		const accessKeyId =
			options.accessKeyId ??
			process.env.STORAGE_ACCESS_KEY_ID ??
			configEnv?.STORAGE_ACCESS_KEY_ID ??
			process.env.S3_ACCESS_KEY_ID ??
			process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey =
			options.secretAccessKey ??
			process.env.STORAGE_SECRET_ACCESS_KEY ??
			configEnv?.STORAGE_SECRET_ACCESS_KEY ??
			process.env.S3_SECRET_ACCESS_KEY ??
			process.env.AWS_SECRET_ACCESS_KEY;
		const sessionToken =
			options.sessionToken ??
			process.env.STORAGE_SESSION_TOKEN ??
			configEnv?.STORAGE_SESSION_TOKEN ??
			process.env.S3_SESSION_TOKEN ??
			process.env.AWS_SESSION_TOKEN;
		const region =
			options.region ??
			process.env.STORAGE_REGION ??
			configEnv?.STORAGE_REGION ??
			process.env.S3_REGION ??
			process.env.AWS_REGION;
		const publicUrlBase =
			options.publicUrlBase ??
			process.env.STORAGE_PUBLIC_URL ??
			configEnv?.STORAGE_PUBLIC_URL ??
			process.env.S3_PUBLIC_URL;

		return new BunS3FileStorage({
			bucket,
			endpoint,
			accessKeyId,
			secretAccessKey,
			sessionToken,
			region,
			publicUrlBase,
			acl: options.acl,
			client: options.client,
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
export const photoStorage: FileStorage = fileStorage;
