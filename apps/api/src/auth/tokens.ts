import { createHash, randomBytes } from 'node:crypto';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const OTP_TTL_SECONDS = 5 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
export const REFRESH_COOKIE_NAME = 'refresh';

export function generateRefreshToken(): string {
	return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function generateOtpCode(): string {
	const bytes = randomBytes(3);
	const number = (bytes[0] ?? 0) * 65536 + (bytes[1] ?? 0) * 256 + (bytes[2] ?? 0);
	return String(number % 1000000).padStart(6, '0');
}
