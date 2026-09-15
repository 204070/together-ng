import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { loginFn } from '../../lib/server';

// Placeholder login (registration/onboarding content lands in #8). On success
// the access token is stored in a readable cookie so SSR loaders and server
// functions can forward it with an Authorization header, then the user is
// home without a hard page reload.
export const Route = createFileRoute('/auth/login')({
	component: LoginPage,
});

function LoginPage() {
	const login = useServerFn(loginFn);
	const navigate = useNavigate();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [failure, setFailure] = useState<string | null>(null);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setFailure(null);
		try {
			const result = await login({ data: { email, password } });
			// biome-ignore lint/suspicious/noDocumentCookie: cookie set for SSR credential forwarding
			document.cookie = `together_token=${encodeURIComponent(result.token)}; path=/; max-age=900`;
			localStorage.setItem('together_token', result.token);
			await navigate({ to: '/' });
		} catch (error) {
			setFailure(error instanceof Error ? error.message : 'Could not sign in');
		}
	}

	return (
		<section>
			<h1>Sign in</h1>
			<form onSubmit={onSubmit}>
				<label>
					Email
					<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
				</label>
				<label>
					Password
					<input
						type="password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</label>
				<button type="submit">Sign in</button>
			</form>
			{failure ? <p role="alert">{failure}</p> : null}
			<p>
				No account? <Link to="/auth/register">Register</Link>
			</p>
		</section>
	);
}
