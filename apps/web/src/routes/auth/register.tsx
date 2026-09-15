import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { registerFn } from '../../lib/server';

// Placeholder registration (onboarding content lands in #8).
export const Route = createFileRoute('/auth/register')({
	component: RegisterPage,
});

function RegisterPage() {
	const register = useServerFn(registerFn);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [done, setDone] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setFailure(null);
		try {
			await register({ data: { email, password } });
			setDone(true);
		} catch (error) {
			setFailure(error instanceof Error ? error.message : 'Could not register');
		}
	}

	return (
		<section>
			<h1>Register</h1>
			{done ? (
				<p>
					Account created. <Link to="/auth/login">Sign in</Link>
				</p>
			) : (
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
					<button type="submit">Register</button>
				</form>
			)}
			{failure ? <p role="alert">{failure}</p> : null}
		</section>
	);
}
