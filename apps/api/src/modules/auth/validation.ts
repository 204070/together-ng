import {
	LoginWithOtp,
	LoginWithPassword,
	RegisterRequest,
	RegisterRequestWithEmail,
	Value,
	VerifyOtpRequest,
} from '@together/schemas';
import { collectValidationIssues } from '../../lib/validation';

export function validateRegisterRequest(value: unknown): Record<string, string> {
	const obj = value as Record<string, unknown> | undefined;
	const hasEmail = typeof obj?.email === 'string' && obj.email !== '';
	const hasPhone = typeof obj?.phone === 'string' && obj.phone !== '';

	if (hasEmail) {
		if (Value.Check(RegisterRequestWithEmail, value)) return {};
		return collectValidationIssues(RegisterRequestWithEmail, value);
	}

	if (hasPhone) {
		if (Value.Check(RegisterRequest, value)) return {};
		return collectValidationIssues(RegisterRequest, value);
	}

	if (Value.Check(RegisterRequest, value)) return {};
	return collectValidationIssues(RegisterRequest, value);
}

export function validateLoginWithPassword(value: unknown): Record<string, string> {
	if (Value.Check(LoginWithPassword, value)) return {};
	return collectValidationIssues(LoginWithPassword, value);
}

export function validateLoginWithOtp(value: unknown): Record<string, string> {
	if (Value.Check(LoginWithOtp, value)) return {};
	return collectValidationIssues(LoginWithOtp, value);
}

export function validateVerifyOtpRequest(value: unknown): Record<string, string> {
	if (Value.Check(VerifyOtpRequest, value)) return {};
	return collectValidationIssues(VerifyOtpRequest, value);
}
