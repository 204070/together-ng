import { beforeEach, describe, expect, test } from 'bun:test';
import { Pool } from 'pg';
import { getApiConfig } from '../../lib/config';
import { CATEGORIES, migrate, seedCategories } from './index';

const databaseUrl = getApiConfig().database.url;

describe('database schema and migrations', () => {
	const pool = new Pool({ connectionString: databaseUrl, max: 10 });

	beforeEach(async () => {
		await migrate(databaseUrl);
	});

	test('applying migrations twice is idempotent', async () => {
		await migrate(databaseUrl);
		const result = await pool.query('SELECT hash FROM drizzle.__drizzle_migrations');
		expect(result.rows.length).toBeGreaterThan(0);
	});

	test('seed inserts Section 7.3 categories and is idempotent', async () => {
		const countCategories = async (): Promise<number> => {
			const result = await pool.query<{ count: number }>(
				'SELECT count(*)::int AS count FROM public.categories',
			);
			return result.rows[0]?.count ?? 0;
		};

		const before = await countCategories();
		const firstInsert = await seedCategories(databaseUrl);
		const afterFirst = await countCategories();
		expect(afterFirst).toBe(before + firstInsert);
		if (before === 0) {
			expect(firstInsert).toBe(CATEGORIES.length);
		}
		expect(afterFirst).toBeGreaterThanOrEqual(17);

		const secondInsert = await seedCategories(databaseUrl);
		const afterSecond = await countCategories();
		expect(secondInsert).toBe(0);
		expect(afterSecond).toBe(afterFirst);
	});

	const REQUIRED_TABLES = [
		'users',
		'profiles',
		'categories',
		'skills',
		'contributor_capabilities',
		'requests',
		'request_responses',
		'contributions',
		'outcome_confirmations',
		'votes',
		'notifications',
		'notification_preferences',
		'request_matches',
		'reports',
		'audit_log',
		'badges',
	];

	test('all required tables exist', async () => {
		const result = await pool.query<{ table_name: string }>(`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
		`);
		const tableNames = result.rows.map((row) => row.table_name);
		for (const table of REQUIRED_TABLES) {
			expect(tableNames, `expected table ${table}`).toContain(table);
		}
	});

	test('requests has tsvector search column, vector embedding and GIN index', async () => {
		const columns = await pool.query<{ column_name: string; type: string }>(`
			SELECT a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS type
			FROM pg_attribute a
			JOIN pg_class c ON c.oid = a.attrelid
			WHERE c.relname = 'requests' AND c.relnamespace = 'public'::regnamespace
				AND a.attnum > 0 AND NOT a.attisdropped
		`);
		expect(
			columns.rows.some((c) => c.column_name === 'search_vector' && c.type === 'tsvector'),
		).toBe(true);
		expect(
			columns.rows.some((c) => c.column_name === 'embedding' && c.type === 'vector(384)'),
		).toBe(true);

		const ginIndexes = await pool.query<{ indexname: string }>(`
			SELECT indexname
			FROM pg_indexes
			WHERE schemaname = 'public' AND tablename = 'requests' AND indexdef ILIKE '%USING gin%'
		`);
		expect(ginIndexes.rows.length).toBeGreaterThan(0);
	});

	test('votes enforces UNIQUE (user_id, request_id)', async () => {
		const constraints = await pool.query<{ conname: string }>(`
			SELECT conname
			FROM pg_constraint
			WHERE conrelid = 'public.votes'::regclass AND contype = 'u'
		`);
		expect(constraints.rows.some((c) => c.conname === 'votes_user_request_unique')).toBe(true);
	});

	test('pg_trgm and vector extensions are enabled', async () => {
		const extensions = await pool.query<{ extname: string }>(`
			SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_trgm')
		`);
		expect(extensions.rows.map((e) => e.extname).sort()).toEqual(['pg_trgm', 'vector']);
	});
});
