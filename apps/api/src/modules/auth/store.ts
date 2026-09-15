import type { Sql } from '@together/db';

export interface UserRow {
	id: string;
	email: string;
	email_verified: boolean;
	phone: string | null;
	phone_verified: boolean;
	password_hash: string;
	is_admin: boolean;
	status: string;
	last_login_at: Date | null;
	created_at: Date;
	updated_at: Date;
	deleted_at: Date | null;
}

export interface OtpRow {
	id: string;
	user_id: string;
	phone: string;
	context: 'verify' | 'login';
	code_hash: string;
	expires_at: Date;
	attempts: number;
	used_at: Date | null;
	created_at: Date;
}

export interface SessionRow {
	id: string;
	user_id: string;
	refresh_hash: string;
	created_at: Date;
	expires_at: Date;
}

export class AuthStore {
	constructor(private readonly sql: Sql) {}

	async findUserByEmail(email: string): Promise<UserRow | undefined> {
		const rows = await this.sql<UserRow[]>`
			SELECT id, email, email_verified, phone, phone_verified, password_hash, is_admin, status,
				last_login_at, created_at, updated_at, deleted_at
			FROM users
			WHERE email = ${email}
		`;
		return rows[0];
	}

	async findUserByPhone(phone: string): Promise<UserRow | undefined> {
		const rows = await this.sql<UserRow[]>`
			SELECT id, email, email_verified, phone, phone_verified, password_hash, is_admin, status,
				last_login_at, created_at, updated_at, deleted_at
			FROM users
			WHERE phone = ${phone}
		`;
		return rows[0];
	}

	async findUserById(id: string): Promise<UserRow | undefined> {
		const rows = await this.sql<UserRow[]>`
			SELECT id, email, email_verified, phone, phone_verified, password_hash, is_admin, status,
				last_login_at, created_at, updated_at, deleted_at
			FROM users
			WHERE id = ${id}
		`;
		return rows[0];
	}

	async insertUser(input: {
		email: string;
		passwordHash: string;
		phone: string | null;
	}): Promise<UserRow> {
		const rows = await this.sql<UserRow[]>`
			INSERT INTO users (email, password_hash, phone)
			VALUES (${input.email}, ${input.passwordHash}, ${input.phone})
			RETURNING id, email, email_verified, phone, phone_verified, password_hash, is_admin, status,
				last_login_at, created_at, updated_at, deleted_at
		`;
		return rows[0] as UserRow;
	}

	async setPhoneVerified(userId: string): Promise<void> {
		await this.sql`UPDATE users SET phone_verified = true, updated_at = now() WHERE id = ${userId}`;
	}

	async touchLastLogin(userId: string): Promise<void> {
		await this.sql`UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = ${userId}`;
	}

	async deleteOtpsForPhone(phone: string): Promise<void> {
		await this.sql`DELETE FROM otp_tokens WHERE phone = ${phone}`;
	}

	async insertOtp(input: {
		userId: string;
		phone: string;
		context: 'verify' | 'login';
		codeHash: string;
		expiresAt: Date;
	}): Promise<OtpRow> {
		const rows = await this.sql<OtpRow[]>`
			INSERT INTO otp_tokens (user_id, phone, context, code_hash, expires_at)
			VALUES (${input.userId}, ${input.phone}, ${input.context}, ${input.codeHash}, ${input.expiresAt})
			RETURNING id, user_id, phone, context, code_hash, expires_at, attempts, used_at, created_at
		`;
		return rows[0] as OtpRow;
	}

	async findOtpForPhone(phone: string): Promise<OtpRow | undefined> {
		const rows = await this.sql<OtpRow[]>`
			SELECT id, user_id, phone, context, code_hash, expires_at, attempts, used_at, created_at
			FROM otp_tokens
			WHERE phone = ${phone}
			ORDER BY created_at DESC
			LIMIT 1
		`;
		return rows[0];
	}

	async incrementOtpAttempts(id: string): Promise<void> {
		await this.sql`UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ${id}`;
	}

	async markOtpUsed(id: string): Promise<void> {
		await this.sql`UPDATE otp_tokens SET used_at = now() WHERE id = ${id}`;
	}

	async insertSession(input: {
		userId: string;
		refreshHash: string;
		expiresAt: Date;
	}): Promise<SessionRow> {
		const rows = await this.sql<SessionRow[]>`
			INSERT INTO sessions (user_id, refresh_hash, expires_at)
			VALUES (${input.userId}, ${input.refreshHash}, ${input.expiresAt})
			RETURNING id, user_id, refresh_hash, created_at, expires_at
		`;
		return rows[0] as SessionRow;
	}

	async findSessionByRefreshHash(refreshHash: string): Promise<SessionRow | undefined> {
		const rows = await this.sql<SessionRow[]>`
			SELECT id, user_id, refresh_hash, created_at, expires_at
			FROM sessions
			WHERE refresh_hash = ${refreshHash}
		`;
		return rows[0];
	}

	async deleteSessionById(id: string): Promise<void> {
		await this.sql`DELETE FROM sessions WHERE id = ${id}`;
	}

	async deleteSessionByRefreshHash(refreshHash: string): Promise<void> {
		await this.sql`DELETE FROM sessions WHERE refresh_hash = ${refreshHash}`;
	}
}
