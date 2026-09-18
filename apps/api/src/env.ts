import type { ApiConfig } from './config';
import type { Db } from './infra/database';
import type { RedisService } from './infra/redis';
import type { FileStorage } from './infra/storage';
import type { OtpSender } from './modules/auth/otp-sender';
import type { MatchingService } from './worker/matching';

export interface AppEnv {
	config?: ApiConfig;
	db?: Db;
	matching?: MatchingService;
	storage?: FileStorage;
	otpSender?: OtpSender;
	redis?: RedisService;
}
