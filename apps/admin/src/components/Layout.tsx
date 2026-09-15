import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const NAV = [
	{ to: '/', label: 'Dashboard', end: true },
	{ to: '/reports', label: 'Reports', end: false },
	{ to: '/categories', label: 'Categories', end: false },
	{ to: '/users', label: 'Users', end: false },
	{ to: '/audit-log', label: 'Audit Log', end: false },
];

export function Layout() {
	const { session, logout } = useAuth();
	const navigate = useNavigate();

	const onLogout = () => {
		logout();
		navigate('/login', { replace: true });
	};

	return (
		<div className="admin-shell">
			<aside className="admin-sidebar">
				<div className="admin-brand">Together Admin</div>
				<nav aria-label="Admin">
					<ul>
						{NAV.map((item) => (
							<li key={item.to}>
								<NavLink
									to={item.to}
									end={item.end}
									className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
								>
									{item.label}
								</NavLink>
							</li>
						))}
					</ul>
				</nav>
			</aside>
			<div className="admin-main">
				<header className="admin-header">
					<span className="admin-user">{session?.email ?? ''}</span>
					<button type="button" onClick={onLogout}>
						Logout
					</button>
				</header>
				<main className="admin-content">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
