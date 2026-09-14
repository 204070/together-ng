import {
	createRootRoute,
	type ErrorComponentProps,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from '@tanstack/react-router';
import { Header } from '../components/header';
import { getAuthUserFn } from '../lib/server';

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ title: 'Together' },
		],
	}),
	loader: () => getAuthUserFn(),
	notFoundComponent: NotFoundPage,
	errorComponent: RootErrorPage,
	component: RootComponent,
});

function RootComponent() {
	const auth = Route.useLoaderData();
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<Header auth={auth} />
				<main>
					<Outlet />
				</main>
				<Scripts />
			</body>
		</html>
	);
}

function NotFoundPage() {
	return (
		<section>
			<h1>Page not found</h1>
			<p>This page does not exist.</p>
			<Link to="/">Back to the feed</Link>
		</section>
	);
}

function RootErrorPage({ error, reset }: ErrorComponentProps) {
	const message = error instanceof Error ? error.message : String(error);
	return (
		<section>
			<h1>Something went wrong</h1>
			<p>{message}</p>
			<button type="button" onClick={() => reset()}>
				Retry
			</button>{' '}
			<Link to="/" reloadDocument>
				Reload the feed
			</Link>
		</section>
	);
}
