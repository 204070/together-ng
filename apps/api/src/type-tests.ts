import type {
	AuthResponseType,
	LoginRequestType,
	RegisterRequestType,
	UserPrivateType,
} from '@together/schemas';
import type { api } from './treaty';

type Expect<T extends true> = T;
type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type RouteBody<F extends (...args: never[]) => unknown> = Parameters<F>[0];
type RouteData<F extends () => Promise<unknown>> = NonNullable<
	Awaited<ReturnType<F>> extends { data: infer D } ? D : never
>;

type RegisterPost = typeof api.auth.register.post;
type LoginPost = typeof api.auth.login.post;
type MeGet = typeof api.auth.me.get;
type HealthGet = typeof api.health.get;

type RegisterData = RouteData<RegisterPost>;
type LoginData = RouteData<LoginPost>;

export type AssertRegisterBodyIsRawJson = Expect<Equal<RouteBody<RegisterPost>, unknown>>;
export type AssertLoginBodyIsRawJson = Expect<Equal<RouteBody<LoginPost>, unknown>>;
export type AssertRegisterRequestType = Expect<Equal<RegisterRequestType, RegisterRequestType>>;
export type AssertLoginRequestType = Expect<Equal<LoginRequestType, LoginRequestType>>;
export type AssertRegisterDataIsUserPrivate = Expect<
	Equal<Omit<RegisterData, 'status'>, Omit<UserPrivateType, 'status'>> &
		(UserPrivateType extends RegisterData ? true : false)
>;
export type AssertLoginDataIsAuthResponse = Expect<
	Equal<Omit<LoginData, 'user'>, Omit<AuthResponseType, 'user'>> &
		(AuthResponseType extends LoginData ? true : false) &
		Equal<LoginData['user'], Omit<UserPrivateType, 'status'>>
>;
export type AssertMeDataIsUserPrivate = Expect<
	Equal<Omit<RouteData<MeGet>, 'status'>, Omit<UserPrivateType, 'status'>> &
		(UserPrivateType extends RouteData<MeGet> ? true : false)
>;
export type AssertHealthDataIsOk = Expect<Equal<RouteData<HealthGet>, { status: 'ok' }>>;
