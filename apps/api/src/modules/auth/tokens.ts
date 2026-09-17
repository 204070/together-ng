import { Buffer } from 'node:buffer';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

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
	return String(randomInt(100_000, 1_000_000));
}

export function hashOtpCode(code: string, secret: string): string {
	return createHmac('sha256', secret).update(code).digest('hex');
}

export function verifyOtpCode(code: string, expectedHash: string, secret: string): boolean {
	const computedHash = hashOtpCode(code, secret);
	const computedBuf = Buffer.from(computedHash);
	const expectedBuf = Buffer.from(expectedHash);
	if (computedBuf.length !== expectedBuf.length) {
		return false;
	}
	return timingSafeEqual(computedBuf, expectedBuf);
}
