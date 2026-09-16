import { Pool } from 'pg';
import { env, loadEnv } from '@together/config';

loadEnv();

export const CATEGORIES: { name: string; slug: string }[] = [
	{ name: 'Education', slug: 'education' },
	{ name: 'Technology', slug: 'technology' },
	{ name: 'Science', slug: 'science' },
	{ name: 'Engineering', slug: 'engineering' },
	{ name: 'Business', slug: 'business' },
	{ name: 'Arts', slug: 'arts' },
	{ name: 'Design', slug: 'design' },
	{ name: 'Writing', slug: 'writing' },
	{ name: 'Languages', slug: 'languages' },
	{ name: 'Skilled trades', slug: 'skilled-trades' },
	{ name: 'Books', slug: 'books' },
	{ name: 'Tools', slug: 'tools' },
	{ name: 'Equipment', slug: 'equipment' },
	{ name: 'Career guidance', slug: 'career-guidance' },
	{ name: 'Entrepreneurship', slug: 'entrepreneurship' },
	{ name: 'Research', slug: 'research' },
	{ name: 'Local knowledge', slug: 'local-knowledge' },
];

export async function seedCategories(databaseUrl: string = env.DATABASE_URL): Promise<number> {
	const pool = new Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	try {
		let inserted = 0;
		await client.query('BEGIN');
		try {
			for (const category of CATEGORIES) {
				const result = await client.query(
					'INSERT INTO public.categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING RETURNING id',
					[category.name, category.slug],
				);
				inserted += result.rowCount ?? 0;
			}
			await client.query('COMMIT');
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		}
		console.log(`categories in catalog: ${CATEGORIES.length}, inserted now: ${inserted}`);
		return inserted;
	} finally {
		client.release();
		await pool.end();
	}
}

if (import.meta.main) {
	await seedCategories();
}
