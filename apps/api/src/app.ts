import { env as configEnv, loadEnv } from '@together/config';
import { createDb, type Db } from '@together/db';
import { ValueErrorType } from '@together/schemas';
import { Elysia } from 'elysia';
import { ValidationError } from 'elysia/error';
import { HttpError } from './lib/errors';
import { createVoteWsRouter } from './lib/vote-ws';
import { createAdminRouter } from './modules/admin/routes';
import { createAuthRouter } from './modules/auth/routes';
import { type AppEnv, createAuthServices } from './modules/auth/services';
import { createContributionRouter } from './modules/contributions/routes';
import { createContributionServices } from './modules/contributions/services';
import { createFeedRouter } from './modules/feed';
import { createNotificationRouter } from './modules/notifications/routes';
import { createProfileRouter } from './modules/profiles/routes';
import { createProfileServices } from './modules/profiles/services';
import { createOfferRouter } from './modules/requests/offer';
import { createRequestRouter } from './modules/requests/routes';
import { createRequestServices, type RequestServices } from './modules/requests/services';
import { createVoteRouter } from './modules/requests/vote';
import { createTaxonomyRouter } from './modules/taxonomy/routes';
import { createInternalMatchingRouter } from './worker/matching';

loadEnv();

export function makeApp(env: AppEnv = {}) {
	const databaseUrl = env.databaseUrl ?? configEnv.DATABASE_URL;
	const db: Db = env.db ?? createDb(databaseUrl);

	const authServices = createAuthServices(env, { db });
	const profileServices = createProfileServices(env, {
		db,
		users: authServices.store,
	});
	const requestServices = createRequestServices(env, {
		db,
		authStore: authServices.store,
		now: authServices.now,
		matching: env.matching,
	});

	const contributionServices = createContributionServices(env, {
		db,
		authStore: authServices.store,
		now: authServices.now,
	});

	const app = new Elysia()
		.get('/health', () => ({ status: 'ok' as const }))
		.onError(({ error, code, set }) => {
			if (error instanceof HttpError) {
				set.status = error.status;
				if (typeof error.retryAfterSeconds === 'number') {
					set.headers['retry-after'] = String(error.retryAfterSeconds);
				}
				return error.body();
			}
			if (code === 'VALIDATION' && error instanceof ValidationError) {
				set.status = 400;
				return {
					error: 'VALIDATION',
					message: 'Invalid request',
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
		.use(createFeedRouter(authServices))
		.use(createAdminRouter(authServices))
		.use(createProfileRouter(profileServices))
		.use(createTaxonomyRouter(authServices))
		.use(createRequestRouter(requestServices))
		.use(createOfferRouter(requestServices))
		.use(createVoteRouter(requestServices))
		.use(createContributionRouter(contributionServices))
		.use(createVoteWsRouter())
		.use(
			createNotificationRouter(
				{ db },
				{
					findUserById: (id: string) => authServices.store.findUserById(id),
					jwtSecret: authServices.jwtSecret,
				},
			),
		)
		.use(
			createInternalMatchingRouter(db, {
				findUserById: (id: string) => authServices.store.findUserById(id),
				jwtSecret: authServices.jwtSecret,
			}),
		);

	app.decorate('services', authServices);
	app.decorate('requestServices', requestServices as RequestServices);

	return app;
}

function validationFields(
	errors: ReadonlyArray<{ path: string; type: string | number }>,
): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const error of errors) {
		const key = normalizePath(error.path);
		if (key !== '' && !(key in fields)) fields[key] = fieldCode(error.type);
	}
	return fields;
}

function normalizePath(path: string): string {
	const segments = path.replace(/^\//, '').split('/').filter(Boolean);
	if (segments[0] === 'body') segments.shift();
	return segments.join('.');
}

function fieldCode(type: number | string): string {
	if (type === ValueErrorType.ObjectRequiredProperty) return 'required';
	if (type === ValueErrorType.StringFormatUnknown || type === ValueErrorType.StringFormat)
		return 'format';
	if (type === ValueErrorType.StringMinLength || type === ValueErrorType.StringMaxLength)
		return 'min_length';
	if (type === ValueErrorType.ObjectAdditionalProperties) return 'additional_properties';
	return String(type);
}

export const app = makeApp();

export type App = typeof app;
