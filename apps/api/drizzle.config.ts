import { defineConfig } from 'drizzle-kit';
import { getApiConfig } from './src/lib/config';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/infra/database/schema/**',
	out: './src/infra/database/migrations',
	dbCredentials: {
		url: getApiConfig().database.url,
	},
});
