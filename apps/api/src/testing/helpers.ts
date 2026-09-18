import { makeApp } from '../app';
import { getApiConfig } from '../config';
import type { AppEnv } from '../env';
import { eq, getDatabase } from '../infra/database';
import {
	categories,
	contributorCapabilities,
	notificationPreferences,
	requests,
	skills,
	users,
} from '../infra/database/schema';

export const DEFAULT_PASSWORD = 'password123';
export const DEFAULT_PASSWORD_HASH =
	'$argon2id$v=19$m=65536,t=2,p=1$khyolO2YTML8xcB1vMoAIu13FszlR7i6u2suxwYCcvI$RMWKolHN6VZnXsTK8+ue5qQrdFNjWFLsa4FvItIWepU';
export const DEFAULT_JWT_SECRET = getApiConfig().jwtSecret;
export const TEST_DATABASE_URL = getApiConfig().databaseUrl;

let seq = 0;
export function unique(prefix: string): string {
	return `${prefix}-${Date.now()}-${++seq}`;
}

export interface CreateUserOverrides {
	email?: string;
	passwordHash?: string;
	isAdmin?: boolean;
	status?: 'active' | 'suspended';
	phoneVerified?: boolean;
}

export async function createUser(
	emailOrOverrides?: string | CreateUserOverrides,
	isAdmin = false,
): Promise<{ id: string; email: string }> {
	const db = getDatabase();
	let email: string;
	let overrides: CreateUserOverrides;

	if (typeof emailOrOverrides === 'string') {
		email = emailOrOverrides;
		overrides = { isAdmin };
	} else if (emailOrOverrides) {
		email = emailOrOverrides.email ?? `${unique('user')}@example.com`;
		overrides = emailOrOverrides;
	} else {
		email = `${unique('user')}@example.com`;
		overrides = { isAdmin };
	}

	const [row] = await db
		.insert(users)
		.values({
			email,
			passwordHash: overrides.passwordHash ?? DEFAULT_PASSWORD_HASH,
			phoneVerified: overrides.phoneVerified ?? true,
			isAdmin: overrides.isAdmin ?? isAdmin,
			status: overrides.status ?? 'active',
		})
		.returning();
	if (!row) throw new Error('Failed to create user');
	return { id: row.id, email };
}

export async function createToken(
	user: { id: string } | string,
	options: { sid?: string; exp?: number; secret?: string } = {},
): Promise<string> {
	const secret = options.secret ?? DEFAULT_JWT_SECRET;
	const userId = typeof user === 'string' ? user : user.id;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const exp = options.exp ?? Math.floor(Date.now() / 1000) + 900;
	const payload = Buffer.from(
		JSON.stringify({
			sub: userId,
			sid: options.sid ?? `test-session-${Date.now()}`,
			iat: Math.floor(Date.now() / 1000),
			exp,
		}),
	).toString('base64url');
	const input = `${header}.${payload}`;
	const signature = Buffer.from(
		await crypto.subtle.sign('HMAC', key, encoder.encode(input)),
	).toString('base64url');
	return `${input}.${signature}`;
}

export async function loginToken(
	_app: unknown,
	emailOrUser: string | { id: string },
	options?: { secret?: string },
): Promise<string> {
	if (typeof emailOrUser === 'string' && emailOrUser.includes('@')) {
		const [user] = await getDatabase()
			.select()
			.from(users)
			.where(eq(users.email, emailOrUser.toLowerCase()));
		if (!user) throw new Error(`User not found: ${emailOrUser}`);
		return createToken(user, options);
	}
	return createToken(emailOrUser, options);
}

export function authHeaders(token: string): { authorization: string } {
	return { authorization: `Bearer ${token}` };
}

export async function userAuth(
	overrides?: CreateUserOverrides,
	tokenOptions?: { sid?: string; exp?: number; secret?: string },
): Promise<{
	user: { id: string; email: string };
	token: string;
	headers: { authorization: string };
}> {
	const user = await createUser(overrides);
	const token = await createToken(user, tokenOptions);
	return {
		user,
		token,
		headers: authHeaders(token),
	};
}

export async function adminAuth(
	overrides?: CreateUserOverrides,
	tokenOptions?: { sid?: string; exp?: number; secret?: string },
): Promise<{
	user: { id: string; email: string };
	token: string;
	headers: { authorization: string };
}> {
	const user = await createUser({ ...overrides, isAdmin: true });
	const token = await createToken(user, tokenOptions);
	return {
		user,
		token,
		headers: authHeaders(token),
	};
}

export async function createCategory(name?: string): Promise<{ id: number; slug: string }> {
	const db = getDatabase();
	const slug = name ?? unique('cat');
	const [row] = await db.insert(categories).values({ name: slug, slug }).returning();
	if (!row) throw new Error('Failed to create category');
	return { id: row.id, slug };
}

export async function createCategoryId(name?: string): Promise<number> {
	const { id } = await createCategory(name);
	return id;
}

export async function createSkill(
	categoryId: number,
	name?: string,
): Promise<{ id: number; slug: string }> {
	const db = getDatabase();
	const slug = name ?? unique('skill');
	const [row] = await db.insert(skills).values({ categoryId, name: slug, slug }).returning();
	if (!row) throw new Error('Failed to create skill');
	return { id: row.id, slug };
}

export async function createSkillId(categoryId: number, name?: string): Promise<number> {
	const { id } = await createSkill(categoryId, name);
	return id;
}

export async function addCapability(input: {
	userId: string;
	categoryId?: number | null;
	skillId?: number | null;
	modality?: string;
	location?: string | null;
}): Promise<void> {
	const db = getDatabase();
	await db.insert(contributorCapabilities).values({
		userId: input.userId,
		categoryId: input.categoryId ?? null,
		skillId: input.skillId ?? null,
		modality: (input.modality as 'in_person' | 'online' | 'both') ?? 'both',
		location: input.location ?? null,
	});
}

export async function setPrefs(userId: string, patch: Record<string, unknown>): Promise<void> {
	const db = getDatabase();
	const defaults = {
		inAppEnabled: Boolean(patch.inAppEnabled ?? patch.in_app_enabled ?? true),
		notifyNewMatches: Boolean(patch.notifyNewMatches ?? patch.notify_new_matches ?? true),
		notifyRemote: Boolean(patch.notifyRemote ?? patch.notify_remote ?? true),
		notifyLocal: Boolean(patch.notifyLocal ?? patch.notify_local ?? true),
		notifyResourceLending: Boolean(
			patch.notifyResourceLending ?? patch.notify_resource_lending ?? true,
		),
		notifyMentorship: Boolean(patch.notifyMentorship ?? patch.notify_mentorship ?? true),
	};
	await db
		.insert(notificationPreferences)
		.values({
			userId,
			...defaults,
		})
		.onConflictDoUpdate({
			target: [notificationPreferences.userId],
			set: defaults,
		});
}

export interface CreateRequestOptions {
	authorId?: string;
	categoryId?: number | null;
	title?: string;
	goal?: string;
	barrier?: string;
	helpNeeded?: string;
	modality?: 'in_person' | 'online' | 'both' | string;
	helpType?: 'borrow' | 'learn' | null;
	location?: string | null;
	state?: 'draft' | 'published' | 'closed' | string;
}

/**
 * Creates a request row.
 * Supports both signatures:
 * - createRequest(options) -> auto-creates author/category if omitted!
 * - createRequest(authorId, fields) -> backward compatible
 */
export async function createRequest(
	authorIdOrOptions?: string | CreateRequestOptions,
	maybeFields?: CreateRequestOptions,
): Promise<string> {
	const db = getDatabase();

	let authorId: string;
	let categoryId: number | null | undefined;
	let fields: CreateRequestOptions;

	if (typeof authorIdOrOptions === 'string') {
		authorId = authorIdOrOptions;
		fields = maybeFields ?? {};
		categoryId = fields.categoryId;
	} else {
		fields = authorIdOrOptions ?? {};
		if (fields.authorId) {
			authorId = fields.authorId;
		} else {
			const author = await createUser();
			authorId = author.id;
		}
		if (fields.categoryId !== undefined) {
			categoryId = fields.categoryId;
		} else {
			const category = await createCategory();
			categoryId = category.id;
		}
	}

	const [row] = await db
		.insert(requests)
		.values({
			authorId,
			categoryId: categoryId ?? null,
			title: fields.title ?? 'Help with soldering',
			goal: fields.goal ?? 'Learn to solder a simple circuit for a school project',
			barrier: fields.barrier ?? 'No tools and no guidance from anyone nearby',
			helpNeeded: fields.helpNeeded ?? 'Someone patient who can show me the basics',
			state: (fields.state as 'draft' | 'published' | 'closed') ?? 'published',
			modality: (fields.modality as 'in_person' | 'online' | 'both') ?? 'both',
			helpType: (fields.helpType as 'borrow' | 'learn' | null) ?? null,
			location: fields.location ?? null,
		})
		.returning();
	if (!row) throw new Error('Failed to create request');
	return row.id;
}

export interface RequestFixture {
	id: string;
	author: { id: string; email: string };
	category: { id: number; slug: string };
	authorAuth: {
		user: { id: string; email: string };
		token: string;
		headers: { authorization: string };
	};
}

/**
 * Auto-creates author (with token and auth headers), category, and published request in 1 line.
 */
export async function createRequestFixture(
	options?: CreateRequestOptions & {
		author?: { id: string; email: string };
		category?: { id: number; slug: string };
	},
): Promise<RequestFixture> {
	const author = options?.author ?? (await createUser());
	const category = options?.category ?? (await createCategory());
	const id = await createRequest(author.id, {
		...options,
		categoryId: category.id,
	});
	const authorAuth = {
		user: author,
		token: await createToken(author),
		headers: authHeaders(await createToken(author)),
	};
	return { id, author, category, authorAuth };
}

export function makeTestApp(envOverrides: AppEnv = {}): ReturnType<typeof makeApp> {
	return makeApp({
		db: getDatabase(),
		...envOverrides,
	});
}

/**
 * Unified helper namespace matching the Klump `$` pattern.
 */
export const $ = {
	createUser,
	createToken,
	loginToken,
	authHeaders,
	userAuth,
	adminAuth,
	createCategory,
	createCategoryId,
	createSkill,
	createSkillId,
	addCapability,
	setPrefs,
	createRequest,
	createRequestFixture,
	makeTestApp,
};
