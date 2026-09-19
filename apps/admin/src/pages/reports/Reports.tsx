import type { ReportListItemType, ReportsQueryType } from '@together/schemas';
import { useCallback, useEffect, useState } from 'react';
import { fetchAdminReports } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ReportDetailModal } from './ReportDetailModal';

const CATEGORY_OPTIONS = [
	{ value: '', label: 'All Categories' },
	{ value: 'request', label: 'Requests' },
	{ value: 'profile', label: 'Profiles' },
	{ value: 'contribution', label: 'Contributions' },
	{ value: 'message', label: 'Messages' },
	{ value: 'resource', label: 'Resources' },
	{ value: 'resource_listing', label: 'Resource Listings' },
	{ value: 'lending_agreement', label: 'Lending Agreements' },
];

const STATUS_OPTIONS = [
	{ value: '', label: 'All Statuses' },
	{ value: 'pending', label: 'Pending' },
	{ value: 'under_review', label: 'Under Review' },
	{ value: 'resolved', label: 'Resolved' },
	{ value: 'dismissed', label: 'Dismissed' },
];

export function Reports() {
	const { session } = useAuth();
	const token = session?.token ?? null;
	const [reports, setReports] = useState<ReportListItemType[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [limit] = useState(25);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState('');
	const [categoryFilter, setCategoryFilter] = useState('');
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const loadReports = useCallback(async () => {
		if (!token) return;
		setLoading(true);
		setError(null);
		try {
			const params: ReportsQueryType = { page, limit };
			if (statusFilter) params.status = statusFilter as ReportsQueryType['status'];
			if (categoryFilter) params.category = categoryFilter as ReportsQueryType['category'];
			const data = await fetchAdminReports(token, params);
			setReports(data.reports);
			setTotal(data.total);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Failed to load reports');
		} finally {
			setLoading(false);
		}
	}, [token, page, limit, statusFilter, categoryFilter]);

	useEffect(() => {
		loadReports();
	}, [loadReports]);

	return (
		<div className="reports-page">
			<h1>Reports Queue</h1>

			<div className="filters">
				<label>
					Status
					<select
						aria-label="Filter by status"
						value={statusFilter}
						onChange={(e) => {
							setStatusFilter(e.target.value);
							setPage(1);
						}}
						disabled={loading}
					>
						{STATUS_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				</label>

				<label>
					Category
					<select
						aria-label="Filter by category"
						value={categoryFilter}
						onChange={(e) => {
							setCategoryFilter(e.target.value);
							setPage(1);
						}}
						disabled={loading}
					>
						{CATEGORY_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				</label>
			</div>

			{error && (
				<div className="error" role="alert">
					<p>Failed to load reports: {error}</p>
					<button type="button" onClick={loadReports}>
						Retry
					</button>
				</div>
			)}

			{loading ? (
				<div className="reports-skeleton" role="status" aria-label="Loading reports">
					{[0, 1, 2].map((i) => (
						<div key={i} className="skeleton-row">
							Loading report…
						</div>
					))}
				</div>
			) : !error && reports.length === 0 ? (
				<p>No reports pending</p>
			) : (
				!error && (
					<>
						<table className="reports-table">
							<thead>
								<tr>
									<th>Reason</th>
									<th>Category</th>
									<th>Status</th>
									<th>Created</th>
									<th>Reported content</th>
								</tr>
							</thead>
							<tbody>
								{reports.map((report) => (
									<tr key={report.id}>
										<td>{report.reason}</td>
										<td>{report.category}</td>
										<td>
											<span className={`status-badge status-${report.status}`}>
												{report.status}
											</span>
										</td>
										<td>{new Date(report.createdAt).toLocaleString()}</td>
										<td>
											<button type="button" onClick={() => setSelectedId(report.id)}>
												View report
											</button>
										</td>
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

			{selectedId && (
				<ReportDetailModal
					reportId={selectedId}
					onClose={() => setSelectedId(null)}
					onActionComplete={loadReports}
				/>
			)}
		</div>
	);
}
