/**
 * HTTP-safe errors used at the API boundary.
 *
 * Domain modules may expose constructors for their own error codes, but the
 * transport shape and status semantics live here rather than in auth.
 */
export interface ErrorBody {
	error: string;
	message?: string;
	fields?: Record<string, string>;
}

export class HttpError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		public readonly fields?: Record<string, string>,
		public readonly retryAfterSeconds?: number,
		public readonly messageOverride?: string,
	) {
		super(code);
	}

	body(): ErrorBody {
		const body: ErrorBody = { error: this.code };
		if (this.fields !== undefined) body.fields = this.fields;
		if (this.messageOverride !== undefined) body.message = this.messageOverride;
		return body;
	}
}

export const validationError = (fields: Record<string, string>): HttpError =>
	new HttpError(400, 'VALIDATION', fields, undefined, 'Invalid request');

export const unauthorizedError = (): HttpError =>
	new HttpError(401, 'UNAUTHORIZED', undefined, undefined, 'Authentication required');

export const forbiddenError = (
	code = 'ADMIN_ACCESS_REQUIRED',
	message = 'Admin access required',
): HttpError => new HttpError(403, code, undefined, undefined, message);

export const rateLimitedError = (code: string, retryAfterSeconds: number): HttpError =>
	new HttpError(429, code, undefined, retryAfterSeconds, 'Too many requests, try again later');
