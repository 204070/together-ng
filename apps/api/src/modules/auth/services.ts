import { getApiConfig } from '../../config';
import type { Db } from '../../infra/database';
import { FixedWindowRateLimiter } from '../../lib/rate-limit';
import { createOtpSender, type OtpSender } from './otp-sender';
import { AuthStore } from './store';

export const LOGIN_WINDOW_MS = 60_000;
export const LOGIN_MAX_HITS = 10;
export const OTP_SEND_WINDOW_MS = 60_000;
export const OTP_SEND_MAX_HITS = 1;
export const OTP_VERIFY_WINDOW_MS = 60_000;
export const OTP_VERIFY_MAX_HITS = 10;

export interface AuthServices {
	db: Db;
	store: AuthStore;
	jwtSecret: string;
	isProduction: boolean;
	otpSender: OtpSender;
	limiters: {
		login: FixedWindowRateLimiter;
		otpSend: FixedWindowRateLimiter;
		otpVerify: FixedWindowRateLimiter;
	};
}

export interface AuthServicesConfig {
	db: Db;
	otpSender?: OtpSender;
	limiters?: {
		login: FixedWindowRateLimiter;
		otpSend: FixedWindowRateLimiter;
		otpVerify: FixedWindowRateLimiter;
	};
}

export function createAuthServices(config: AuthServicesConfig): AuthServices {
	const apiConfig = getApiConfig();
	return {
		db: config.db,
		store: new AuthStore(config.db),
		jwtSecret: apiConfig.jwtSecret,
		isProduction: apiConfig.isProduction,
		otpSender: config.otpSender ?? createOtpSender(),
		limiters: config.limiters ?? {
			login: new FixedWindowRateLimiter(LOGIN_WINDOW_MS, LOGIN_MAX_HITS),
			otpSend: new FixedWindowRateLimiter(OTP_SEND_WINDOW_MS, OTP_SEND_MAX_HITS),
			otpVerify: new FixedWindowRateLimiter(OTP_VERIFY_WINDOW_MS, OTP_VERIFY_MAX_HITS),
		},
	};
}
