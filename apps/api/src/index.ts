import { app } from './app';

const port = Number(process.env.PORT ?? 4004);

app
	.listen(port, async () => {
		if (process.env.NODE_ENV !== 'test') {
			console.log(`@together/api listening on http://localhost:${port}`);
		}
	})
	.on('error', (error) => {
		console.error('@together/api failed to boot:', error);
		process.exit(1);
	});
