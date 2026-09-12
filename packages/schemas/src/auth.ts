import { type Static, Type } from '@sinclair/typebox';
import './formats';
import { UserPrivate } from './user';

export const OTPCode = Type.String({ pattern: '^[0-9]{6}$' });

export const LoginWithPassword = Type.Object(
	{
		email: Type.String({ format: 'email' }),
		password: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
);

export const LoginWithOtp = Type.Object(
	{
		phone: Type.String({ format: 'e164' }),
		code: OTPCode,
	},
	{ additionalProperties: false },
);

export const LoginRequest = Type.Union([LoginWithPassword, LoginWithOtp]);

export const SendOtpRequest = Type.Object(
	{
		phone: Type.String({ format: 'e164' }),
	},
	{ additionalProperties: false },
);

export const VerifyOtpRequest = Type.Object(
	{
		phone: Type.String({ format: 'e164' }),
		code: OTPCode,
	},
	{ additionalProperties: false },
);

export const AuthResponse = Type.Object({
	token: Type.String(),
	user: UserPrivate,
});

export type OTPCodeType = Static<typeof OTPCode>;
export type LoginWithPasswordType = Static<typeof LoginWithPassword>;
export type LoginWithOtpType = Static<typeof LoginWithOtp>;
export type LoginRequestType = Static<typeof LoginRequest>;
export type SendOtpRequestType = Static<typeof SendOtpRequest>;
export type VerifyOtpRequestType = Static<typeof VerifyOtpRequest>;
export type AuthResponseType = Static<typeof AuthResponse>;
