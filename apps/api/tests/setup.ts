import { afterAll, afterEach, beforeEach } from 'bun:test';
import { drizzle, getDatabase, getPool, initDatabase, setDatabase } from '@together/db';
import * as schema from '@together/db/schema';

// Initialize database once for all test workers
if (process.env.DATABASE_URL) {
	initDatabase(process.env.DATABASE_URL);
}

let client: Awaited<ReturnType<ReturnType<typeof getPool>['connect']>> | null = null;
let originalDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

beforeEach(async () => {
	const pool = getPool();
	originalDb = getDatabase();
	client = await pool.connect();
	await client.query('BEGIN');
	const txDb = drizzle(client, { schema });
	setDatabase(txDb);
});

afterEach(async () => {
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
