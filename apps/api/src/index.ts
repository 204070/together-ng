import { env, loadEnv } from '@together/config';
import { app } from './app';

loadEnv();

const port = env.PORT;

app
	.listen(port, async () => {
		if (env.NODE_ENV !== 'test') {
			console.log(`@together/api listening on http://localhost:${port}`);
		}
	})
	.on('error', (error) => {
		console.error('@together/api failed to boot:', error);
		process.exit(1);
	});
