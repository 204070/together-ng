import { Link } from 'react-router-dom';

export function NotFound() {
	return (
		<div>
			<h1>404 — Page not found</h1>
			<p>This admin page does not exist.</p>
			<Link to="/">Go to dashboard</Link>
		</div>
	);
}
