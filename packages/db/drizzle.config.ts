import { env, loadEnv } from '@together/config';
import { defineConfig } from 'drizzle-kit';

loadEnv();

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/schema/**',
	out: './drizzle',
	dbCredentials: {
		url: env.DATABASE_URL,
	},
});
