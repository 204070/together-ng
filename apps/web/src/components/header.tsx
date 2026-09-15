import { Link } from '@tanstack/react-router';
import type { AuthState } from '../lib/server';

export function Header({ auth }: { auth: AuthState }) {
	const { user, profile } = auth;
	const displayName = profile?.name ?? user?.email ?? null;
	return (
		<header>
			<nav aria-label="Primary">
				<Link to="/">Together</Link>
				<Link to="/">Feed</Link>
				<Link to="/requests/new">Ask for help</Link>
				{displayName ? (
					<span>
						{profile?.photoUrl ? (
							<img src={profile.photoUrl} alt="" width={24} height={24} />
						) : null}
						{displayName}
					</span>
				) : (
					<Link to="/auth/login">Sign in</Link>
				)}
			</nav>
		</header>
	);
}
