import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Login() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			await login(email.trim(), password);
			navigate('/', { replace: true });
		} catch (err) {
			if (err instanceof ApiError) {
				setError(err.message);
			} else {
				setError('Something went wrong, please try again');
			}
		} finally {
			setPending(false);
		}
	};

	return (
		<div className="login-page">
			<h1>Admin login</h1>
			<form onSubmit={onSubmit}>
				<label htmlFor="email">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					autoComplete="username"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					required
				/>
				<label htmlFor="password">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					required
				/>
				{error !== null && (
					<p role="alert" className="login-error">
						{error}
					</p>
				)}
				<button type="submit" disabled={pending}>
					{pending ? 'Signing in…' : 'Sign in'}
				</button>
			</form>
		</div>
	);
}
