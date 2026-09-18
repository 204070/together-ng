import { afterAll, describe, expect, mock, test } from 'bun:test';
import type { S3Client } from 'bun';
import { resetTestConfig, setTestConfig } from '../config';
import {
	BunS3FileStorage,
	buildAttachmentKey,
	buildConditionPhotoKey,
	buildFileKey,
	buildPhotoKey,
	createFileStorage,
	fileStorage,
	MockFileStorage,
} from './storage';

describe('MockFileStorage', () => {
	test('stores and retrieves binary data with put and get', async () => {
		const storage = new MockFileStorage();
		const data = new Uint8Array([1, 2, 3, 4]);
		const key = 'test/file.png';

		await storage.put(key, data, 'image/png');
		const result = await storage.get(key);

		expect(result).toEqual(data);
	});

	test('returns null for non-existent key on get', async () => {
		const storage = new MockFileStorage();
		const result = await storage.get('non-existent.txt');
		expect(result).toBeNull();
	});

	test('checks existence correctly with exists', async () => {
		const storage = new MockFileStorage();
		const key = 'test/exists.txt';

		expect(await storage.exists(key)).toBe(false);
		await storage.put(key, new Uint8Array([10]), 'text/plain');
		expect(await storage.exists(key)).toBe(true);
	});

	test('deletes files with delete', async () => {
		const storage = new MockFileStorage();
		const key = 'test/delete.txt';

		await storage.put(key, new Uint8Array([10]), 'text/plain');
		expect(await storage.exists(key)).toBe(true);

		await storage.delete(key);
		expect(await storage.exists(key)).toBe(false);
		expect(await storage.get(key)).toBeNull();
	});

	test('generates public url with mock domain', () => {
		const storage = new MockFileStorage();
		expect(storage.publicUrl('photos/123/img.jpg')).toBe('https://mock.storage/photos/123/img.jpg');
		expect(storage.publicUrl('/photos/123/img.jpg')).toBe(
			'https://mock.storage/photos/123/img.jpg',
		);
	});

	test('clears all items with clear', async () => {
		const storage = new MockFileStorage();
		await storage.put('a', new Uint8Array([1]), 'text/plain');
		await storage.put('b', new Uint8Array([2]), 'text/plain');

		storage.clear();
		expect(await storage.get('a')).toBeNull();
		expect(await storage.get('b')).toBeNull();
	});

	test('provides entry details via getEntry helper', async () => {
		const storage = new MockFileStorage();
		const data = new Uint8Array([5, 6]);
		await storage.put('file.pdf', data, 'application/pdf');

		const entry = storage.getEntry('file.pdf');
		expect(entry).toBeDefined();
		expect(entry?.bytes).toEqual(data);
		expect(entry?.contentType).toBe('application/pdf');
	});
});

describe('BunS3FileStorage', () => {
	test('generates public url using custom publicUrlBase', () => {
		const storage = new BunS3FileStorage({
			bucket: 'my-bucket',
			publicUrlBase: 'https://cdn.together.app',
			client: {} as unknown as S3Client,
		});

		expect(storage.publicUrl('photos/user1/avatar.jpg')).toBe(
			'https://cdn.together.app/photos/user1/avatar.jpg',
		);
		expect(storage.publicUrl('/photos/user1/avatar.jpg')).toBe(
			'https://cdn.together.app/photos/user1/avatar.jpg',
		);
	});

	test('generates public url using custom endpoint (e.g. MinIO/R2)', () => {
		const storage = new BunS3FileStorage({
			bucket: 'together-media',
			endpoint: 'http://localhost:9000',
			client: {} as unknown as S3Client,
		});

		expect(storage.publicUrl('attachments/123/doc.pdf')).toBe(
			'http://localhost:9000/together-media/attachments/123/doc.pdf',
		);
	});

	test('generates public url using standard AWS S3 format', () => {
		const storage = new BunS3FileStorage({
			bucket: 'together-prod',
			client: {} as unknown as S3Client,
		});

		expect(storage.publicUrl('photos/u1/photo.jpg')).toBe(
			'https://together-prod.s3.amazonaws.com/photos/u1/photo.jpg',
		);
	});

	test('generates public url using standard AWS S3 format with region', () => {
		const storage = new BunS3FileStorage({
			bucket: 'together-prod',
			region: 'af-south-1',
			client: {} as unknown as S3Client,
		});

		expect(storage.publicUrl('photos/u1/photo.jpg')).toBe(
			'https://together-prod.s3.af-south-1.amazonaws.com/photos/u1/photo.jpg',
		);
	});

	test('delegates put to mocked S3Client without making network requests', async () => {
		const writeMock = mock(async () => 4);
		const mockClient = {
			write: writeMock,
		} as unknown as S3Client;

		const storage = new BunS3FileStorage({
			bucket: 'test-bucket',
			acl: 'public-read',
			client: mockClient,
		});

		const bytes = new Uint8Array([1, 2, 3, 4]);
		await storage.put('files/test.png', bytes, 'image/png');

		expect(writeMock).toHaveBeenCalledTimes(1);
		expect(writeMock).toHaveBeenCalledWith('files/test.png', bytes, {
			type: 'image/png',
			acl: 'public-read',
		});
	});

	test('delegates get to mocked S3Client and returns Uint8Array', async () => {
		const sampleBytes = new Uint8Array([9, 8, 7]);
		const mockClient = {
			file: mock(() => ({
				exists: mock(async () => true),
				arrayBuffer: mock(async () => sampleBytes.buffer),
			})),
		} as unknown as S3Client;

		const storage = new BunS3FileStorage({
			bucket: 'test-bucket',
			client: mockClient,
		});

		const result = await storage.get('test/file.bin');
		expect(result).toEqual(sampleBytes);
	});

	test('returns null when file does not exist on S3 get', async () => {
		const mockClient = {
			file: mock(() => ({
				exists: mock(async () => false),
				arrayBuffer: mock(async () => new ArrayBuffer(0)),
			})),
		} as unknown as S3Client;

		const storage = new BunS3FileStorage({
			bucket: 'test-bucket',
			client: mockClient,
		});

		const result = await storage.get('missing.txt');
		expect(result).toBeNull();
	});

	test('delegates delete to mocked S3Client', async () => {
		const deleteMock = mock(async () => {});
		const mockClient = {
			delete: deleteMock,
		} as unknown as S3Client;

		const storage = new BunS3FileStorage({
			bucket: 'test-bucket',
			client: mockClient,
		});

		await storage.delete('old/file.txt');
		expect(deleteMock).toHaveBeenCalledWith('old/file.txt');
	});

	test('delegates exists to mocked S3Client', async () => {
		const mockClient = {
			file: mock(() => ({
				exists: mock(async () => true),
			})),
		} as unknown as S3Client;

		const storage = new BunS3FileStorage({
			bucket: 'test-bucket',
			client: mockClient,
		});

		expect(await storage.exists('check.txt')).toBe(true);
	});
});

describe('createFileStorage selection', () => {
	test('defaults to MockFileStorage when STORAGE_PROVIDER is mock (D17)', () => {
		setTestConfig({
			storage: {
				provider: 'mock',
				bucket: 'test-bucket',
				region: 'us-east-1',
			},
		});
		const storage = createFileStorage();
		expect(storage).toBeInstanceOf(MockFileStorage);
	});

	test('selects BunS3FileStorage when STORAGE_PROVIDER=s3', () => {
		setTestConfig({
			storage: {
				provider: 's3',
				bucket: 'env-bucket',
				region: 'us-east-1',
			},
		});
		const storage = createFileStorage();
		expect(storage).toBeInstanceOf(BunS3FileStorage);
	});

	test('switches storage provider based on central config', () => {
		setTestConfig({
			storage: {
				provider: 'mock',
				bucket: 'test-bucket',
				region: 'us-east-1',
			},
		});
		expect(createFileStorage()).toBeInstanceOf(MockFileStorage);

		setTestConfig({
			storage: {
				provider: 's3',
				bucket: 'custom-bucket',
				region: 'us-east-1',
			},
		});
		expect(createFileStorage()).toBeInstanceOf(BunS3FileStorage);
	});

	afterAll(() => {
		resetTestConfig();
	});
});

describe('Key generation helpers', () => {
	test('buildPhotoKey creates valid photo key with default extension', () => {
		const userId = '00000000-0000-0000-0000-000000000001';
		const key = buildPhotoKey(userId);
		expect(key).toMatch(/^photos\/00000000-0000-0000-0000-000000000001\/[0-9a-f-]+\.jpg$/);
	});

	test('buildPhotoKey creates valid photo key with custom extension', () => {
		const userId = '00000000-0000-0000-0000-000000000001';
		const key = buildPhotoKey(userId, 'png');
		expect(key).toMatch(/^photos\/00000000-0000-0000-0000-000000000001\/[0-9a-f-]+\.png$/);
	});

	test('buildAttachmentKey creates valid attachment key without filename', () => {
		const entityId = 'item-123';
		const key = buildAttachmentKey(entityId);
		expect(key).toMatch(/^attachments\/item-123\/[0-9a-f-]+$/);
	});

	test('buildAttachmentKey preserves file extension from filename', () => {
		const entityId = 'item-123';
		const key = buildAttachmentKey(entityId, 'report.pdf');
		expect(key).toMatch(/^attachments\/item-123\/[0-9a-f-]+\.pdf$/);
	});

	test('buildConditionPhotoKey creates condition photo key', () => {
		const agreementId = 'agree-456';
		const key = buildConditionPhotoKey(agreementId);
		expect(key).toMatch(/^conditions\/agree-456\/[0-9a-f-]+\.jpg$/);
	});

	test('buildFileKey creates generic key with given prefix', () => {
		const key = buildFileKey('documents', 'doc-789', '.txt');
		expect(key).toMatch(/^documents\/doc-789\/[0-9a-f-]+\.txt$/);
	});
});
