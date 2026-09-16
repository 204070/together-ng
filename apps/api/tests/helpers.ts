import { eq, getDatabase } from '@together/db';
import {
	contributorCapabilities,
	categories,
	notificationPreferences,
	requests,
	requestMatches,
	skills,
	users,
} from '@together/db/schema';

let seq = 0;
function unique(prefix: string): string {
	return `${prefix}-${Date.now()}-${++seq}`;
}

export async function createUser(overrides?: {
	email?: string;
	isAdmin?: boolean;
	status?: string;
}): Promise<{ id: string; email: string }> {
	const db = getDatabase();
	const email = overrides?.email ?? `${unique('user')}@example.com`;
	const hash = await Bun.password.hash('password123', { algorithm: 'argon2id' });
	const [row] = await db
		.insert(users)
		.values({
			email,
			passwordHash: hash,
			phoneVerified: true,
			isAdmin: overrides?.isAdmin ?? false,
			status: (overrides?.status as 'active' | 'suspended') ?? 'active',
		})
		.returning();
	return { id: row!.id, email };
}

export async function createCategory(name?: string): Promise<{ id: number; slug: string }> {
	const db = getDatabase();
	const slug = name ?? unique('cat');
	const [row] = await db
		.insert(categories)
		.values({ name: slug, slug })
		.returning();
	return { id: row!.id, slug };
}

export async function createSkill(
	categoryId: number,
	name?: string,
): Promise<{ id: number; slug: string }> {
	const db = getDatabase();
	const slug = name ?? unique('skill');
	const [row] = await db
		.insert(skills)
		.values({ categoryId, name: slug, slug })
		.returning();
	return { id: row!.id, slug };
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
		modality: (input.modality as 'in_person' | 'remote' | 'both') ?? 'both',
		location: input.location ?? null,
	});
}

export async function setPrefs(
	userId: string,
	patch: Record<string, unknown>,
): Promise<void> {
	const db = getDatabase();
	const defaults = {
		notifyNewMatches: true,
		notifyRemote: true,
		notifyLocal: true,
		notifyResourceLending: true,
		notifyMentorship: true,
		inAppEnabled: true,
		...patch,
	};
	await db
		.insert(notificationPreferences)
		.values({
			userId,
			inAppEnabled: defaults.inAppEnabled as boolean,
			notifyNewMatches: defaults.notifyNewMatches as boolean,
			notifyRemote: defaults.notifyRemote as boolean,
			notifyLocal: defaults.notifyLocal as boolean,
			notifyResourceLending: defaults.notifyResourceLending as boolean,
			notifyMentorship: defaults.notifyMentorship as boolean,
		})
		.onConflictDoUpdate({
			target: [notificationPreferences.userId],
			set: {
				inAppEnabled: defaults.inAppEnabled as boolean,
				notifyNewMatches: defaults.notifyNewMatches as boolean,
				notifyRemote: defaults.notifyRemote as boolean,
				notifyLocal: defaults.notifyLocal as boolean,
				notifyResourceLending: defaults.notifyResourceLending as boolean,
				notifyMentorship: defaults.notifyMentorship as boolean,
			},
		});
}

export async function createRequest(
	authorId: string,
	fields: {
		categoryId: number | null;
		title?: string;
		goal?: string;
		barrier?: string;
		helpNeeded?: string;
		modality?: string;
		helpType?: string;
		location?: string | null;
		state?: string;
	},
): Promise<string> {
	const db = getDatabase();
	const [row] = await db
		.insert(requests)
		.values({
			authorId,
			categoryId: fields.categoryId,
			title: fields.title ?? 'Help with soldering',
			goal: fields.goal ?? 'Learn to solder a simple circuit for a school project',
			barrier: fields.barrier ?? 'No tools and no guidance from anyone nearby',
			helpNeeded: fields.helpNeeded ?? 'Someone patient who can show me the basics',
			state: (fields.state as 'draft' | 'published' | 'closed') ?? 'published',
			modality: (fields.modality as 'in_person' | 'remote' | 'both') ?? 'both',
			helpType: (fields.helpType as 'borrow' | 'learn' | null) ?? null,
			location: fields.location ?? null,
		})
		.returning();
	return row!.id;
}

export async function loginToken(
	app: { handle: (req: Request) => Promise<Response> },
	email: string,
): Promise<string> {
	const res = await app.handle(
		new Request('http://localhost:4013/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email, password: 'password123' }),
		}),
	);
	const body = (await res.json()) as { token: string };
	return body.token;
}
