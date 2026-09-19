import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './lib/auth';
import { AuditLog as AuditLogPage } from './pages/AuditLog';
import { Categories } from './pages/Categories';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Dashboard, Users } from './pages/placeholders';
import { Reports as ReportsPage } from './pages/reports/Reports';

function RequireAdmin({ children }: { children: React.ReactElement }) {
	const { session, ready } = useAuth();
	if (!ready) return <p>Loading…</p>;
	if (session === null) return <Navigate to="/login" replace />;
	return children;
}

export function App() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route
				element={
					<RequireAdmin>
						<Layout />
					</RequireAdmin>
				}
			>
				<Route index element={<Dashboard />} />
				<Route path="reports" element={<ReportsPage />} />
				<Route path="categories" element={<Categories />} />
				<Route path="users" element={<Users />} />
				<Route path="audit-log" element={<AuditLogPage />} />
			</Route>
			<Route path="*" element={<NotFound />} />
		</Routes>
	);
}
