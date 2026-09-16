import { env as configEnv } from '@together/config';
import { createDb, type Db, getPool } from '@together/db';
import { FixedWindowRateLimiter } from '../../lib/rate-limit';
import type { MatchingService } from '../../worker/matching';
import { createOtpSender, type OtpSender } from './otp-sender';
import { AuthStore } from './store';

export const LOGIN_WINDOW_MS = 60_000;
export const LOGIN_MAX_HITS = 10;
export const OTP_SEND_WINDOW_MS = 60_000;
export const OTP_SEND_MAX_HITS = 1;
export const OTP_VERIFY_WINDOW_MS = 60_000;
export const OTP_VERIFY_MAX_HITS = 10;

export interface AppEnv {
	databaseUrl?: string;
	jwtSecret?: string;
	otpProvider?: 'mock' | 'termii';
	isProduction?: boolean;
	now?: () => Date;
	db?: Db;
	matching?: MatchingService;
}

export interface AuthServices {
	db: Db;
	store: AuthStore;
	jwtSecret: string;
	isProduction: boolean;
	now: () => Date;
	otpSender: OtpSender;
	close: () => Promise<void>;
	limiters: {
		login: FixedWindowRateLimiter;
		otpSend: FixedWindowRateLimiter;
		otpVerify: FixedWindowRateLimiter;
	};
}

export function createAuthServices(env: AppEnv = {}, deps: { db?: Db } = {}): AuthServices {
	const databaseUrl = env.databaseUrl ?? configEnv.DATABASE_URL;
	const jwtSecret = env.jwtSecret ?? configEnv.JWT_SECRET;
	const isProduction = env.isProduction ?? configEnv.NODE_ENV === 'production';
	const provider = env.otpProvider ?? configEnv.OTP_PROVIDER;
	const now = env.now ?? (() => new Date());
	const db = deps.db ?? env.db ?? createDb(databaseUrl);
	const store = new AuthStore(db);
	const otpSender = createOtpSender(provider);
	return {
		db,
		store,
		jwtSecret,
		isProduction,
		now,
		otpSender,
		close: () =>
			env.db === undefined && deps.db === undefined ? getPool().end() : Promise.resolve(),
		limiters: {
			login: new FixedWindowRateLimiter(LOGIN_WINDOW_MS, LOGIN_MAX_HITS, {
				now: () => now().getTime(),
			}),
			otpSend: new FixedWindowRateLimiter(OTP_SEND_WINDOW_MS, OTP_SEND_MAX_HITS, {
				now: () => now().getTime(),
			}),
			otpVerify: new FixedWindowRateLimiter(OTP_VERIFY_WINDOW_MS, OTP_VERIFY_MAX_HITS, {
				now: () => now().getTime(),
			}),
		},
	};
}
