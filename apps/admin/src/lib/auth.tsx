import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchAdminMe, loginWithPassword, refreshAdminToken } from './api';

export interface AdminSession {
	token: string;
	id: string;
	email: string;
}

const STORAGE_KEY = 'together.admin.session';

function loadStoredSession(): AdminSession | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === null) return null;
		const parsed = JSON.parse(raw) as Partial<AdminSession>;
		if (
			typeof parsed.token === 'string' &&
			typeof parsed.id === 'string' &&
			typeof parsed.email === 'string'
		) {
			return { token: parsed.token, id: parsed.id, email: parsed.email };
		}
		return null;
	} catch {
		return null;
	}
}

interface AuthContextValue {
	session: AdminSession | null;
	ready: boolean;
	login: (email: string, password: string) => Promise<void>;
	logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<AdminSession | null>(null);
	const [ready, setReady] = useState(false);

	// Reload keeps the session: restore the stored token, then re-verify
	// admin access. If the token is expired (401), attempt refresh rotation
	// per D14. A revoked/invalid session clears back to /login.
	useEffect(() => {
		const stored = loadStoredSession();
		if (stored === null) {
			setReady(true);
			return;
		}
		let cancelled = false;
		fetchAdminMe(stored.token)
			.then((me) => {
				if (cancelled) return;
				setSession({ token: stored.token, id: me.id, email: me.email });
				setReady(true);
			})
			.catch(async (error) => {
				if (cancelled) return;
				if (error instanceof ApiError && error.status === 401) {
					try {
						const refreshedToken = await refreshAdminToken();
						const me = await fetchAdminMe(refreshedToken);
						if (cancelled) return;
						const refreshedSession: AdminSession = {
							token: refreshedToken,
							id: me.id,
							email: me.email,
						};
						localStorage.setItem(STORAGE_KEY, JSON.stringify(refreshedSession));
						setSession(refreshedSession);
						setReady(true);
						return;
					} catch {
						// Refresh token failed or expired
					}
				}
				localStorage.removeItem(STORAGE_KEY);
				setSession(null);
				setReady(true);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// Proactive refresh rotation (D14): rotate the 15-minute access token
	// every 12 minutes while the admin tab is open.
	useEffect(() => {
		if (!session) return;
		const interval = setInterval(
			async () => {
				try {
					const newToken = await refreshAdminToken();
					setSession((prev) => {
						if (!prev) return null;
						const next = { ...prev, token: newToken };
						localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
						return next;
					});
				} catch {
					// Non-fatal background refresh failure
				}
			},
			12 * 60 * 1000,
		);
		return () => clearInterval(interval);
	}, [session]);

	const login = useCallback(async (email: string, password: string) => {
		const { token } = await loginWithPassword(email, password);
		let me: { id: string; email: string };
		try {
			me = await fetchAdminMe(token);
		} catch (error) {
			if (error instanceof ApiError && error.status === 403) {
				throw new ApiError(error.status, error.code, 'Admin access required');
			}
			throw error;
		}
		const next: AdminSession = { token, id: me.id, email: me.email };
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		setSession(next);
	}, []);

	const logout = useCallback(() => {
		localStorage.removeItem(STORAGE_KEY);
		setSession(null);
	}, []);

	const value = useMemo(() => ({ session, ready, login, logout }), [session, ready, login, logout]);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (ctx === null) throw new Error('useAuth must be used inside <AuthProvider>');
	return ctx;
}

export { STORAGE_KEY };
