import { type TSchema, Type } from '@sinclair/typebox';
import { Value, ValueErrorType } from '@sinclair/typebox/value';
import { LoginWithOtp, LoginWithPassword, SendOtpRequest, VerifyOtpRequest } from './auth';
import './formats';
import { RegisterRequest } from './user';

export type FieldIssues = Record<string, string>;

const EmailFormat = Type.String({ format: 'email' });
const E164Format = Type.String({ format: 'e164' });

function fieldCode(errorType: number | string): string {
	if (errorType === ValueErrorType.ObjectRequiredProperty) return 'required';
	if (
		errorType === ValueErrorType.StringFormat ||
		errorType === ValueErrorType.StringFormatUnknown
	) {
		return 'format';
	}
	if (
		errorType === ValueErrorType.StringMinLength ||
		errorType === ValueErrorType.StringMaxLength
	) {
		return 'min_length';
	}
	if (errorType === ValueErrorType.ObjectAdditionalProperties) return 'additional_properties';
	return String(errorType);
}

function collectIssues(schema: TSchema, value: unknown): FieldIssues {
	const issues: FieldIssues = {};
	for (const error of Value.Errors(schema, value)) {
		const key = error.path.replace(/^\//, '');
		if (key && !(key in issues)) issues[key] = fieldCode(error.type);
	}
	return issues;
}

export function checkRegisterRequest(value: unknown): FieldIssues {
	if (Value.Check(RegisterRequest, value)) return {};
	return collectIssues(RegisterRequest, value);
}

export function checkLoginWithPassword(value: unknown): FieldIssues {
	if (Value.Check(LoginWithPassword, value)) return {};
	return collectIssues(LoginWithPassword, value);
}

export function checkLoginWithOtp(value: unknown): FieldIssues {
	if (Value.Check(LoginWithOtp, value)) return {};
	return collectIssues(LoginWithOtp, value);
}

export function checkSendOtpRequest(value: unknown): FieldIssues {
	if (Value.Check(SendOtpRequest, value)) return {};
	return collectIssues(SendOtpRequest, value);
}

export function checkVerifyOtpRequest(value: unknown): FieldIssues {
	if (Value.Check(VerifyOtpRequest, value)) return {};
	return collectIssues(VerifyOtpRequest, value);
}

export function isEmail(value: unknown): boolean {
	return typeof value === 'string' && Value.Check(EmailFormat, value);
}

export function isE164Phone(value: unknown): boolean {
	return typeof value === 'string' && Value.Check(E164Format, value);
}
