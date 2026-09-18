import type { Db } from '@together/db';
import type { PhotoStorage } from './lib/storage';
import type { OtpSender } from './modules/auth/otp-sender';
import type { MatchingService } from './worker/matching';

export interface AppEnv {
	databaseUrl?: string;
	jwtSecret?: string;
	otpProvider?: 'mock' | 'termii';
	otpSender?: OtpSender;
	isProduction?: boolean;
	db?: Db;
	matching?: MatchingService;
	redisUrl?: string;
	storage?: PhotoStorage;
}
