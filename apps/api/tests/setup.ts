import { getApiConfig } from '../src/config';
import {
	type Db,
	drizzle,
	getDatabase,
	getPool,
	initDatabase,
	migrate,
	type PoolClient,
	setDatabase,
} from '../src/infra/database';
import * as schema from '../src/infra/database/schema';

// Initialize database and ensure schema is migrated once for all test workers
const config = getApiConfig();
if (config.databaseUrl) {
	initDatabase(config.databaseUrl);
	await migrate(config.databaseUrl);
}

let client: PoolClient | null = null;
let originalDb: Db | null = null;

beforeEach(async () => {
	if ((globalThis as Record<string, unknown>).__SKIP_TX_ISOLATION__) return;
	const pool = getPool();
	originalDb = getDatabase();
	client = await pool.connect();
	await client.query('BEGIN');
	const txDb = drizzle(client, { schema });
	setDatabase(txDb as unknown as Db);
});

afterEach(async () => {
	if ((globalThis as Record<string, unknown>).__SKIP_TX_ISOLATION__) return;
	if (client) {
		await client.query('ROLLBACK');
		client.release();
		client = null;
	}
	if (originalDb) {
		setDatabase(originalDb);
		originalDb = null;
	}
});

afterAll(async () => {
	try {
		await getPool().end();
	} catch {
		// Pool may not be initialized in tests that don't use the database
	}
});
