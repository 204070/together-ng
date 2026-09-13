import { env, loadEnv } from '@together/config';
import postgres from 'postgres';

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
	const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
	try {
		let inserted = 0;
		await sql.begin(async (tx) => {
			for (const category of CATEGORIES) {
				const result = await tx`
					INSERT INTO public.categories (name, slug)
					VALUES (${category.name}, ${category.slug})
					ON CONFLICT (slug) DO NOTHING
					RETURNING id
				`;
				inserted += result.length;
			}
		});
		console.log(`categories in catalog: ${CATEGORIES.length}, inserted now: ${inserted}`);
		return inserted;
	} finally {
		await sql.end();
	}
}

if (import.meta.main) {
	await seedCategories();
}
