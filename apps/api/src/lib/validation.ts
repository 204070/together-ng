import { type TSchema, Value, ValueErrorType } from '@together/schemas';
import { HttpError } from './errors';

export function fieldCode(type: number | string): string {
	if (type === ValueErrorType.ObjectRequiredProperty) return 'required';
	if (type === ValueErrorType.StringFormatUnknown || type === ValueErrorType.StringFormat) {
		return 'format';
	}
	if (type === ValueErrorType.StringMinLength || type === ValueErrorType.StringMaxLength) {
		return 'min_length';
	}
	if (type === ValueErrorType.ObjectAdditionalProperties) return 'additional_properties';
	return String(type);
}

export function normalizePath(path: string): string {
	const segments = path.replace(/^\//, '').split('/').filter(Boolean);
	if (segments[0] === 'body') segments.shift();
	return segments.join('.');
}

export function validationFields(
	errors: ReadonlyArray<{ path: string; type: string | number }>,
): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const error of errors) {
		const key = normalizePath(error.path);
		if (key !== '' && !(key in fields)) fields[key] = fieldCode(error.type);
	}
	return fields;
}

export function collectValidationIssues(schema: TSchema, value: unknown): Record<string, string> {
	const issues: Record<string, string> = {};
	for (const error of Value.Errors(schema, value)) {
		const key = error.path.replace(/^\//, '');
		if (key && !(key in issues)) {
			issues[key] = fieldCode(error.type);
		}
	}
	return issues;
}

export function validateSchema<T>(
	schema: TSchema,
	value: unknown,
	status = 400,
	message = 'Invalid request',
): T {
	const val = (value ?? {}) as unknown;
	if (!Value.Check(schema, val)) {
		const issues = collectValidationIssues(schema, val);
		throw new HttpError(status, 'VALIDATION', issues, undefined, message);
	}
	return val as T;
}
