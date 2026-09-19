import { useCallback, useEffect, useState } from 'react';
import {
	type AdminCategoryDetail,
	type AdminCategoryListItem,
	ApiError,
	createAdminCategory,
	createAdminSkill,
	fetchAdminCategories,
	fetchAdminCategoryDetail,
	mergeAdminCategories,
	relateAdminCategories,
	updateAdminCategory,
	updateAdminSkill,
} from '../lib/api';
import { useAuth } from '../lib/auth';

function toMessage(err: unknown): string {
	if (err instanceof ApiError) return `${err.code}: ${err.message}`;
	return 'Something went wrong, please try again';
}

function statusOf(item: { retiredAt: string | null }): 'Active' | 'Retired' {
	return item.retiredAt === null ? 'Active' : 'Retired';
}

export function Categories() {
	const { session } = useAuth();
	const token = session?.token ?? '';
	const [items, setItems] = useState<AdminCategoryListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [newName, setNewName] = useState('');
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [detail, setDetail] = useState<AdminCategoryDetail | null>(null);

	const reload = useCallback(async () => {
		if (token === '') return;
		setLoading(true);
		setError(null);
		try {
			setItems(await fetchAdminCategories(token));
		} catch (err) {
			setError(toMessage(err));
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const loadDetail = useCallback(
		async (id: number) => {
			try {
				setDetail(await fetchAdminCategoryDetail(token, id));
			} catch (err) {
				setError(toMessage(err));
			}
		},
		[token],
	);

	useEffect(() => {
		if (selectedId === null || token === '') {
			setDetail(null);
			return;
		}
		void loadDetail(selectedId);
	}, [selectedId, token, loadDetail]);

	const refreshAll = useCallback(async () => {
		await reload();
		if (selectedId !== null) await loadDetail(selectedId);
	}, [reload, selectedId, loadDetail]);

	const onCreate = async (event: React.FormEvent) => {
		event.preventDefault();
		const name = newName.trim();
		if (name === '' || token === '') return;
		setError(null);
		try {
			await createAdminCategory(token, { name });
			setNewName('');
			await reload();
		} catch (err) {
			setError(toMessage(err));
		}
	};

	const tops = items.filter((c) => c.parentId === null);
	const childrenOf = (id: number) => items.filter((c) => c.parentId === id);

	if (loading) return <p>Loading categories…</p>;

	return (
		<div>
			<h1>Categories</h1>
			{error !== null && (
				<p role="alert" className="admin-error">
					{error}
				</p>
			)}
			<form onSubmit={onCreate}>
				<label htmlFor="new-category-name">New category name</label>
				<input
					id="new-category-name"
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					maxLength={100}
					placeholder="e.g. Gardening"
				/>
				<button type="submit">Add category</button>
			</form>
			<ul aria-label="Categories">
				{tops.map((cat) => (
					<li key={cat.id}>
						<CategoryRow
							cat={cat}
							onSelect={() => setSelectedId(cat.id)}
							selected={selectedId === cat.id}
						/>
						{childrenOf(cat.id).length > 0 && (
							<ul aria-label={`Subcategories of ${cat.name}`}>
								{childrenOf(cat.id).map((sub) => (
									<li key={sub.id} style={{ marginLeft: '1.5rem' }}>
										<CategoryRow
											cat={sub}
											onSelect={() => setSelectedId(sub.id)}
											selected={selectedId === sub.id}
										/>
									</li>
								))}
							</ul>
						)}
					</li>
				))}
			</ul>
			{detail !== null && (
				<CategoryDetailPanel
					key={detail.id}
					detail={detail}
					items={items}
					onChanged={refreshAll}
					onError={setError}
				/>
			)}
		</div>
	);
}

function CategoryRow({
	cat,
	onSelect,
	selected,
}: {
	cat: AdminCategoryListItem;
	onSelect: () => void;
	selected: boolean;
}) {
	return (
		<div>
			<strong>{cat.name}</strong> <span>{cat.slug}</span> <span>{statusOf(cat)}</span>{' '}
			<span>
				{cat.subcategoryCount} subcategories, {cat.skillCount} skills
			</span>{' '}
			<button type="button" onClick={onSelect} aria-pressed={selected}>
				Manage
			</button>
		</div>
	);
}

function CategoryDetailPanel({
	detail,
	items,
	onChanged,
	onError,
}: {
	detail: AdminCategoryDetail;
	items: AdminCategoryListItem[];
	onChanged: () => Promise<void>;
	onError: (message: string) => void;
}) {
	const { session } = useAuth();
	const token = session?.token ?? '';
	const [rename, setRename] = useState(detail.name);
	const [subName, setSubName] = useState('');
	const [skillName, setSkillName] = useState('');
	const [mergeTarget, setMergeTarget] = useState('');
	const [relatedTarget, setRelatedTarget] = useState('');

	const run = async (fn: () => Promise<unknown>) => {
		try {
			await fn();
			await onChanged();
		} catch (err) {
			onError(toMessage(err));
		}
	};

	const retired = detail.retiredAt !== null;
	const others = items.filter((c) => c.id !== detail.id && c.retiredAt === null);

	return (
		<section aria-label={`Manage ${detail.name}`}>
			<h2>{detail.name}</h2>
			<p>
				Related:{' '}
				{detail.relatedCategories.length === 0
					? 'none'
					: detail.relatedCategories.map((c) => c.name).join(', ')}
			</p>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (rename.trim() !== '')
						void run(() => updateAdminCategory(token, detail.id, { name: rename.trim() }));
				}}
			>
				<label htmlFor="rename-category">Rename category</label>
				<input
					id="rename-category"
					value={rename}
					onChange={(e) => setRename(e.target.value)}
					maxLength={100}
				/>
				<button type="submit">Save name</button>
			</form>
			<button
				type="button"
				onClick={() =>
					void run(() =>
						updateAdminCategory(token, detail.id, {
							retiredAt: retired ? null : new Date().toISOString(),
						}),
					)
				}
			>
				{retired ? 'Restore category' : 'Retire category'}
			</button>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (subName.trim() !== '')
						void run(() =>
							createAdminCategory(token, { name: subName.trim(), parentId: detail.id }).then(() =>
								setSubName(''),
							),
						);
				}}
			>
				<label htmlFor="new-subcategory">New subcategory</label>
				<input
					id="new-subcategory"
					value={subName}
					onChange={(e) => setSubName(e.target.value)}
					maxLength={100}
				/>
				<button type="submit">Add subcategory</button>
			</form>
			<h3>Skills</h3>
			<ul aria-label="Skills">
				{detail.skills.map((s) => (
					<li key={s.id}>
						{s.name} <span>{statusOf(s)}</span>{' '}
						{s.retiredAt === null && (
							<button
								type="button"
								onClick={() =>
									void run(() =>
										updateAdminSkill(token, s.id, { retiredAt: new Date().toISOString() }),
									)
								}
							>
								Mark obsolete
							</button>
						)}
					</li>
				))}
			</ul>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (skillName.trim() !== '')
						void run(() =>
							createAdminSkill(token, detail.id, skillName.trim()).then(() => setSkillName('')),
						);
				}}
			>
				<label htmlFor="new-skill">New skill</label>
				<input
					id="new-skill"
					value={skillName}
					onChange={(e) => setSkillName(e.target.value)}
					maxLength={100}
				/>
				<button type="submit">Add skill</button>
			</form>
			<h3>Merge</h3>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const targetId = Number(mergeTarget);
					if (Number.isInteger(targetId))
						void run(() => mergeAdminCategories(token, detail.id, targetId));
				}}
			>
				<label htmlFor="merge-target">Merge into</label>
				<select
					id="merge-target"
					value={mergeTarget}
					onChange={(e) => setMergeTarget(e.target.value)}
				>
					<option value="">Select target…</option>
					{others.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</select>
				<button type="submit">Merge</button>
			</form>
			<h3>Related categories</h3>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const relatedId = Number(relatedTarget);
					if (Number.isInteger(relatedId))
						void run(() => relateAdminCategories(token, detail.id, relatedId));
				}}
			>
				<label htmlFor="related-target">Link related</label>
				<select
					id="related-target"
					value={relatedTarget}
					onChange={(e) => setRelatedTarget(e.target.value)}
				>
					<option value="">Select category…</option>
					{others.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</select>
				<button type="submit">Link</button>
			</form>
		</section>
	);
}
