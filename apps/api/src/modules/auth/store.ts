import {
	type Db,
	desc,
	eq,
	type OtpToken,
	otpTokens,
	type Session,
	sessions,
	sql,
	type User,
	users,
} from '../../infra/database';

export class AuthStore {
	constructor(private readonly db: Db) {}

	async findUserByEmail(email: string): Promise<User | undefined> {
		const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
		return rows[0];
	}

	async findUserByPhone(phone: string): Promise<User | undefined> {
		const rows = await this.db.select().from(users).where(eq(users.phone, phone)).limit(1);
		return rows[0];
	}

	async findUserById(id: string): Promise<User | undefined> {
		const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
		return rows[0];
	}

	async insertUser(input: {
		email: string;
		passwordHash: string;
		phone: string | null;
	}): Promise<User> {
		const rows = await this.db
			.insert(users)
			.values({
				email: input.email,
				passwordHash: input.passwordHash,
				phone: input.phone,
			})
			.returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to insert user');
		return row;
	}

	async setPhoneVerified(userId: string): Promise<void> {
		await this.db
			.update(users)
			.set({ phoneVerified: true, updatedAt: new Date() })
			.where(eq(users.id, userId));
	}

	async touchLastLogin(userId: string): Promise<void> {
		await this.db
			.update(users)
			.set({ lastLoginAt: new Date(), updatedAt: new Date() })
			.where(eq(users.id, userId));
	}

	async deleteOtpsForPhone(phone: string): Promise<void> {
		await this.db.delete(otpTokens).where(eq(otpTokens.phone, phone));
	}

	async insertOtp(input: {
		userId: string;
		phone: string;
		context: 'verify' | 'login';
		codeHash: string;
		expiresAt: Date;
	}): Promise<OtpToken> {
		const rows = await this.db
			.insert(otpTokens)
			.values({
				userId: input.userId,
				phone: input.phone,
				context: input.context,
				codeHash: input.codeHash,
				expiresAt: input.expiresAt,
			})
			.returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to insert OTP');
		return row;
	}

	async findOtpForPhone(phone: string): Promise<OtpToken | undefined> {
		const rows = await this.db
			.select()
			.from(otpTokens)
			.where(eq(otpTokens.phone, phone))
			.orderBy(desc(otpTokens.createdAt))
			.limit(1);
		return rows[0];
	}

	async incrementOtpAttempts(id: string): Promise<void> {
		await this.db
			.update(otpTokens)
			.set({ attempts: sql`attempts + 1` })
			.where(eq(otpTokens.id, id));
	}

	async markOtpUsed(id: string): Promise<void> {
		await this.db.update(otpTokens).set({ usedAt: new Date() }).where(eq(otpTokens.id, id));
	}

	async insertSession(input: {
		userId: string;
		refreshHash: string;
		expiresAt: Date;
	}): Promise<Session> {
		const rows = await this.db
			.insert(sessions)
			.values({
				userId: input.userId,
				refreshHash: input.refreshHash,
				expiresAt: input.expiresAt,
			})
			.returning();
		const row = rows[0];
		if (!row) throw new Error('Failed to insert session');
		return row;
	}

	async findSessionByRefreshHash(refreshHash: string): Promise<Session | undefined> {
		const rows = await this.db
			.select()
			.from(sessions)
			.where(eq(sessions.refreshHash, refreshHash))
			.limit(1);
		return rows[0];
	}

	async deleteSessionById(id: string): Promise<void> {
		await this.db.delete(sessions).where(eq(sessions.id, id));
	}

	async deleteSessionByRefreshHash(refreshHash: string): Promise<void> {
		await this.db.delete(sessions).where(eq(sessions.refreshHash, refreshHash));
	}
}

export type UserRow = User;
export type OtpRow = OtpToken;
export type SessionRow = Session;
