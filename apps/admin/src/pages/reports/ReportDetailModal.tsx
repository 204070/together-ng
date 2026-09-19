import type { ReportActionInputType, ReportDetailType } from '@together/schemas';
import { useEffect, useState } from 'react';
import { ApiError, fetchAdminReportDetail, takeReportAction } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface ReportDetailModalProps {
	reportId: string;
	onClose: () => void;
	onActionComplete: () => void;
}

type WireAction = ReportActionInputType['action'];

const ACTIONS: Array<{ action: WireAction; label: string; variant: string }> = [
	{ action: 'warn', label: 'Warn', variant: 'secondary' },
	{ action: 'restrict', label: 'Restrict', variant: 'secondary' },
	{ action: 'suspend', label: 'Suspend', variant: 'danger' },
	{ action: 'restore', label: 'Restore', variant: 'primary' },
	{ action: 'dismiss', label: 'Dismiss', variant: 'secondary' },
];

export function ReportDetailModal({ reportId, onClose, onActionComplete }: ReportDetailModalProps) {
	const { session } = useAuth();
	const token = session?.token ?? null;
	const [detail, setDetail] = useState<ReportDetailType | null>(null);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState<WireAction | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	useEffect(() => {
		async function loadDetail() {
			if (!token) return;
			setLoading(true);
			setError(null);
			try {
				setDetail(await fetchAdminReportDetail(token, reportId));
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to load report');
			} finally {
				setLoading(false);
			}
		}
		loadDetail();
	}, [token, reportId]);

	async function takeAction(action: WireAction) {
		if (!token || actionLoading !== null) return;
		setActionLoading(action);
		setError(null);
		setSuccess(null);
		try {
			const data = await takeReportAction(token, reportId, { action });
			setDetail(data.report);
			setSuccess(`Action "${action}" applied — report ${data.report.status}`);
			onActionComplete();
		} catch (e) {
			if (e instanceof ApiError && e.status === 409) {
				setError('Already resolved — another admin acted first');
				onActionComplete();
			} else {
				setError(e instanceof Error ? e.message : 'Failed to apply action');
			}
		} finally {
			setActionLoading(null);
		}
	}

	const open = detail === null || detail.status === 'pending' || detail.status === 'under_review';

	return (
		<div className="modal-wrapper">
			<button
				type="button"
				className="modal-overlay"
				aria-label="Close report details"
				onClick={onClose}
			/>
			<div className="modal" role="dialog" aria-label="Report details">
				<div className="modal-header">
					<h2>Report Details</h2>
					<button type="button" onClick={onClose} className="close-btn" aria-label="Close">
						×
					</button>
				</div>

				{loading ? (
					<div className="modal-body" role="status" aria-label="Loading report details">
						Loading report details…
					</div>
				) : detail ? (
					<div className="modal-body">
						{error && (
							<div className="error" role="alert">
								{error}
							</div>
						)}
						{success && <div className="success">{success}</div>}

						<dl className="detail-grid">
							<div className="detail-field">
								<dt>Report ID</dt>
								<dd>{detail.id}</dd>
							</div>
							<div className="detail-field">
								<dt>Reason</dt>
								<dd>{detail.reason}</dd>
							</div>
							<div className="detail-field">
								<dt>Description</dt>
								<dd>{detail.description ?? '—'}</dd>
							</div>
							<div className="detail-field">
								<dt>Category</dt>
								<dd>{detail.category}</dd>
							</div>
							<div className="detail-field">
								<dt>Status</dt>
								<dd>
									<span className={`status-badge status-${detail.status}`}>{detail.status}</span>
								</dd>
							</div>
							<div className="detail-field">
								<dt>Created</dt>
								<dd>{new Date(detail.createdAt).toLocaleString()}</dd>
							</div>
							<div className="detail-field">
								<dt>Subject ID</dt>
								<dd>{detail.subjectId}</dd>
							</div>
							{detail.resolvedBy && (
								<div className="detail-field">
									<dt>Resolved By</dt>
									<dd>{detail.resolvedBy}</dd>
								</div>
							)}
							{detail.resolvedAt && (
								<div className="detail-field">
									<dt>Resolved At</dt>
									<dd>{new Date(detail.resolvedAt).toLocaleString()}</dd>
								</div>
							)}
						</dl>

						<div className="detail-section">
							<h3>Reported content</h3>
							<pre>{JSON.stringify(detail.subjectSnapshot, null, 2)}</pre>
						</div>

						{open && (
							<div className="detail-section">
								<h3>Moderation Actions</h3>
								<div className="action-buttons">
									{ACTIONS.map(({ action, label, variant }) => (
										<button
											key={action}
											type="button"
											onClick={() => takeAction(action)}
											disabled={actionLoading !== null}
											className={`btn btn-${variant}`}
										>
											{actionLoading === action ? 'Processing…' : label}
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				) : (
					<div className="modal-body">Failed to load report details</div>
				)}
			</div>
		</div>
	);
}
