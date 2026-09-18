import { env as configEnv, loadEnv } from '@together/config';
import { createDb, type Db } from '@together/db';
import { Elysia } from 'elysia';
import { ValidationError } from 'elysia/error';
import type { AppEnv } from './env';
import { HttpError } from './lib/errors';
import { FixedWindowRateLimiter, RedisRateLimiter } from './lib/rate-limit';
import { createRedisService } from './lib/redis';
import { type PhotoStorage, photoStorage } from './lib/storage';
import { validationFields } from './lib/validation';
import { createVoteWsRouter } from './lib/vote-ws';
import { createAdminRouter } from './modules/admin/routes';
import { createOtpSender, type OtpSender } from './modules/auth/otp-sender';
import { createAuthRouter } from './modules/auth/routes';
import { createAuthServices } from './modules/auth/services';
import { createContributionRouter } from './modules/contributions/routes';
import { ContributionService } from './modules/contributions/services';
import { ContributionStore } from './modules/contributions/store';
import { createFeedRouter } from './modules/feed/routes';
import { createFeedService } from './modules/feed/services';
import { createNotificationRouter } from './modules/notifications/routes';
import { NotificationService } from './modules/notifications/services';
import { NotificationStore } from './modules/notifications/store';
import { createProfileRouter } from './modules/profiles/routes';
import { ProfileService } from './modules/profiles/services';
import { ProfileStore } from './modules/profiles/store';
import { createOfferRouter } from './modules/requests/offer';
import { createRequestRouter } from './modules/requests/routes';
import {
	type AsyncRateLimiter,
	REQUEST_MAX_HITS,
	REQUEST_WINDOW_MS,
	RequestService,
} from './modules/requests/services';
import { RequestStore } from './modules/requests/store';
import { createVoteRouter } from './modules/requests/vote';
import { createTaxonomyRouter } from './modules/taxonomy/routes';
import {
	createInlineMatchingService,
	createInternalMatchingRouter,
	type MatchingService,
} from './worker/matching';

loadEnv();

export function makeApp(env: AppEnv = {}) {
	const db: Db = env.db ?? createDb(env.databaseUrl ?? configEnv.DATABASE_URL);
	const redis = env.redisUrl ? createRedisService(env.redisUrl) : undefined;

	const otpSender: OtpSender =
		env.otpSender ?? createOtpSender(env.otpProvider ?? configEnv.OTP_PROVIDER);
	const authServices = createAuthServices({
		db,
		jwtSecret: env.jwtSecret ?? configEnv.JWT_SECRET,
		isProduction: env.isProduction ?? configEnv.NODE_ENV === 'production',
		otpSender,
	});
	const authContext = {
		findUserById: (id: string) => authServices.store.findUserById(id),
		jwtSecret: authServices.jwtSecret,
	};

	const notificationStore = new NotificationStore(db);
	const notificationService = new NotificationService(notificationStore);

	const photoStorageService: PhotoStorage = env.storage ?? photoStorage;
	const profileStore = new ProfileStore(db);
	const profileService = new ProfileService(profileStore, photoStorageService);

	const requestLimiter: AsyncRateLimiter =
		env.redisUrl && redis
			? new RedisRateLimiter(redis, REQUEST_WINDOW_MS, REQUEST_MAX_HITS)
			: new FixedWindowRateLimiter(REQUEST_WINDOW_MS, REQUEST_MAX_HITS);
	const matchingService: MatchingService = env.matching ?? createInlineMatchingService(db);
	const requestStore = new RequestStore(db);
	const requestService = new RequestService(
		requestStore,
		requestLimiter,
		matchingService,
		notificationService,
	);

	const contributionStore = new ContributionStore(db);
	const contributionService = new ContributionService(contributionStore, notificationService);

	const feedService = createFeedService(db, redis);

	const app = new Elysia()
		.get('/health', () => ({ status: 'ok' as const }))
		.onError(({ error, code, set, path }) => {
			if (error instanceof HttpError) {
				set.status = error.status;
				if (typeof error.retryAfterSeconds === 'number') {
					set.headers['retry-after'] = String(error.retryAfterSeconds);
				}
				return error.body();
			}
			if (code === 'VALIDATION' && error instanceof ValidationError) {
				const isOffer = path?.includes('/offers');
				set.status = isOffer ? 422 : 400;
				return {
					error: 'VALIDATION',
					message: isOffer ? 'Invalid offer' : 'Invalid request',
					fields: validationFields(error.all),
				};
			}
			if (code === 'NOT_FOUND') {
				set.status = 404;
				return { error: 'NOT_FOUND', message: 'Route not found' };
			}
			set.status = 500;
			return { error: 'INTERNAL', message: 'Internal server error' };
		})
		.use(createAuthRouter(authServices))
		.use(createFeedRouter(feedService))
		.use(createAdminRouter(authServices))
		.use(createProfileRouter(profileService, authContext))
		.use(createTaxonomyRouter({ db }))
		.use(createRequestRouter(requestService, authContext))
		.use(createOfferRouter(requestService, authContext))
		.use(createVoteRouter(requestService, authContext))
		.use(createContributionRouter(contributionService, authContext))
		.use(createVoteWsRouter())
		.use(createNotificationRouter(notificationService, authContext))
		.use(createInternalMatchingRouter(db, authContext));

	app.decorate('services', authServices);
	app.decorate('requestServices', requestService);
	app.decorate('profileService', profileService);
	app.decorate('contributionService', contributionService);
	app.decorate('feedService', feedService);
	app.decorate('notificationService', notificationService);

	return app;
}

export const app = makeApp();

export type App = typeof app;
