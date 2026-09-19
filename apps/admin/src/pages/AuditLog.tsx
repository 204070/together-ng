import type { AuditLogEntryType, AuditLogQueryType } from '@together/schemas';
import { useCallback, useEffect, useState } from 'react';
import { fetchAuditLog } from '../lib/api';
import { useAuth } from '../lib/auth';

export function AuditLog() {
	const { session } = useAuth();
	const token = session?.token ?? null;
	const [entries, setEntries] = useState<AuditLogEntryType[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [limit] = useState(25);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actorFilter, setActorFilter] = useState('');
	const [targetFilter, setTargetFilter] = useState('');
	const [actionFilter, setActionFilter] = useState('');

	const loadEntries = useCallback(async () => {
		if (!token) return;
		setLoading(true);
		setError(null);
		try {
			const params: AuditLogQueryType = { page, limit };
			if (actorFilter) params.actorId = actorFilter;
			if (targetFilter) params.entityId = targetFilter;
			if (actionFilter) params.action = actionFilter;
			const data = await fetchAuditLog(token, params);
			setEntries(data.entries);
			setTotal(data.total);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load audit log');
		} finally {
			setLoading(false);
		}
	}, [token, page, limit, actorFilter, targetFilter, actionFilter]);

	useEffect(() => {
		loadEntries();
	}, [loadEntries]);

	return (
		<div className="audit-log-page">
			<h1>Audit Log</h1>

			<div className="filters">
				<label>
					Actor ID
					<input
						type="text"
						aria-label="Filter by actor"
						placeholder="Actor ID"
						value={actorFilter}
						onChange={(e) => {
							setActorFilter(e.target.value);
							setPage(1);
						}}
						disabled={loading}
					/>
				</label>
				<label>
					Target ID
					<input
						type="text"
						aria-label="Filter by target"
						placeholder="Target ID"
						value={targetFilter}
						onChange={(e) => {
							setTargetFilter(e.target.value);
							setPage(1);
						}}
						disabled={loading}
					/>
				</label>
				<label>
					Action
					<input
						type="text"
						aria-label="Filter by action"
						placeholder="e.g. suspend"
						value={actionFilter}
						onChange={(e) => {
							setActionFilter(e.target.value);
							setPage(1);
						}}
						disabled={loading}
					/>
				</label>
			</div>

			{error && (
				<div className="error" role="alert">
					<p>Failed to load audit log: {error}</p>
					<button type="button" onClick={loadEntries}>
						Retry
					</button>
				</div>
			)}

			{loading ? (
				<div className="audit-skeleton" role="status" aria-label="Loading audit log">
					{[0, 1, 2].map((i) => (
						<div key={i} className="skeleton-row">
							Loading audit entry…
						</div>
					))}
				</div>
			) : !error && entries.length === 0 ? (
				<p>No audit entries</p>
			) : (
				!error && (
					<>
						<table className="audit-table">
							<thead>
								<tr>
									<th>Actor</th>
									<th>Action</th>
									<th>Target</th>
									<th>Created</th>
								</tr>
							</thead>
							<tbody>
								{entries.map((entry) => (
									<tr key={entry.id}>
										<td>{entry.actorEmail ?? entry.actorId ?? '—'}</td>
										<td>{entry.action}</td>
										<td>{entry.entityId ?? '—'}</td>
										<td>{new Date(entry.createdAt).toLocaleString()}</td>
									</tr>
								))}
							</tbody>
						</table>

						<div className="pagination">
							<button
								type="button"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page === 1 || loading}
							>
								Previous
							</button>
							<span>
								Page {page} of {Math.ceil(total / limit) || 1} ({total} total)
							</span>
							<button
								type="button"
								onClick={() => setPage((p) => p + 1)}
								disabled={page * limit >= total || loading}
							>
								Next
							</button>
						</div>
					</>
				)
			)}
		</div>
	);
}
