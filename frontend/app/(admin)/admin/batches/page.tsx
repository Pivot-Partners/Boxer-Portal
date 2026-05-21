'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Batch {
	id: string;
	batch_month: string;
	cutoff_at: string;
	status: string;
	total_applications: number;
	valid_applications: number;
	cancelled_applications: number;
	rejected_applications: number;
	approved_at: string | null;
	approved_by: string | null;
}

interface Application {
	id: string;
	reference_number: string;
	display_name: string;
	place_of_work: string;
	rental_term: number;
	status: string;
	submitted_at: string;
	phone_models: { model_name: string } | null;
}

const STATUS_COLOUR: Record<string, string> = {
	open: 'bg-green-100 text-green-800',
	closed: 'bg-gray-100 text-gray-600',
	processing: 'bg-blue-100 text-blue-800',
	awaiting_approval: 'bg-yellow-100 text-yellow-800',
	approved: 'bg-green-100 text-green-800',
	orders_submitted: 'bg-blue-100 text-blue-800',
	completed: 'bg-gray-100 text-gray-600',
};

const APP_STATUS_COLOUR: Record<string, string> = {
	pending: 'bg-yellow-100 text-yellow-700',
	validated: 'bg-green-100 text-green-700',
	converted_to_order: 'bg-blue-100 text-blue-700',
	cancelled_by_employee: 'bg-gray-100 text-gray-500',
	cancelled_no_whitelist: 'bg-red-100 text-red-600',
	cancelled_no_stock: 'bg-red-100 text-red-600',
	rejected: 'bg-red-100 text-red-600',
};

function months(date: string) {
	return new Date(date + '-01').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

export default function BatchesPage() {
	const [batches, setBatches] = useState<Batch[]>([]);
	const [applications, setApplications] = useState<Application[]>([]);
	const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
	const [loading, setLoading] = useState(true);
	const [approving, setApproving] = useState(false);
	const [approveError, setApproveError] = useState('');
	const [openForm, setOpenForm] = useState(false);
	const [newMonth, setNewMonth] = useState('');
	const [newCutoff, setNewCutoff] = useState('');
	const [opening, setOpening] = useState(false);
	const [openError, setOpenError] = useState('');

	async function fetchBatches() {
		const res = await api<{ data: Batch[] }>('/m1/batches');
		const list = res.data ?? [];
		setBatches(list);
		if (!selectedBatch && list.length > 0) setSelectedBatch(list[0]!);
	}

	async function fetchApplications(batchId: string) {
		try {
			const res = await api<{ data: Application[] }>(`/m1/applications?batch_id=${batchId}`);
			setApplications(res.data ?? []);
		} catch {
			setApplications([]);
		}
	}

	useEffect(() => {
		fetchBatches().finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		if (selectedBatch) fetchApplications(selectedBatch.id);
	}, [selectedBatch?.id]);

	async function approveBatch() {
		if (!selectedBatch) return;
		setApproving(true);
		setApproveError('');
		try {
			await api(`/m1/batches/${selectedBatch.id}/approve`, { method: 'POST' });
			await fetchBatches();
		} catch (err) {
			setApproveError(err instanceof Error ? err.message : 'Approval failed');
		} finally {
			setApproving(false);
		}
	}

	async function openBatch(e: React.FormEvent) {
		e.preventDefault();
		setOpening(true);
		setOpenError('');
		try {
			await api('/m1/batches', {
				method: 'POST',
				body: { batch_month: newMonth, cutoff_at: new Date(newCutoff).toISOString() },
			});
			setOpenForm(false);
			setNewMonth('');
			setNewCutoff('');
			await fetchBatches();
		} catch (err) {
			setOpenError(err instanceof Error ? err.message : 'Failed to open batch');
		} finally {
			setOpening(false);
		}
	}

	const hasOpenBatch = batches.some((b) => b.status === 'open');

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="text-gray-400 text-sm">Loading…</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold">Batches</h1>
					<p className="text-gray-500 text-sm mt-1">Manage monthly application batches</p>
				</div>
				{!hasOpenBatch && (
					<button
						onClick={() => setOpenForm(!openForm)}
						className="shrink-0 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-lg transition-colors"
					>
						Open new batch
					</button>
				)}
			</div>

			{/* Open batch form */}
			{openForm && (
				<form onSubmit={openBatch} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
					<h2 className="font-semibold">Open a new batch</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Batch month (YYYY-MM)</label>
							<input
								type="month"
								value={newMonth}
								onChange={(e) => setNewMonth(e.target.value)}
								required
								className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Cut-off date & time</label>
							<input
								type="datetime-local"
								value={newCutoff}
								onChange={(e) => setNewCutoff(e.target.value)}
								required
								className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
							/>
						</div>
					</div>
					{openError && (
						<p className="text-sm text-red-600">{openError}</p>
					)}
					<div className="flex gap-3">
						<button
							type="submit"
							disabled={opening}
							className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
						>
							{opening ? 'Opening…' : 'Open batch'}
						</button>
						<button
							type="button"
							onClick={() => setOpenForm(false)}
							className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
						>
							Cancel
						</button>
					</div>
				</form>
			)}

			{/* Batch list + detail */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Batch list */}
				<div className="space-y-2">
					{batches.length === 0 ? (
						<p className="text-gray-500 text-sm">No batches yet.</p>
					) : (
						batches.map((b) => (
							<button
								key={b.id}
								onClick={() => setSelectedBatch(b)}
								className={`w-full text-left p-4 rounded-xl border transition-colors ${
									selectedBatch?.id === b.id
										? 'border-primary-500 bg-primary-50'
										: 'border-gray-200 bg-white hover:border-gray-300'
								}`}
							>
								<div className="flex items-center justify-between gap-2">
									<p className="font-semibold text-sm">{months(b.batch_month)}</p>
									<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOUR[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
										{b.status.replace(/_/g, ' ')}
									</span>
								</div>
								<p className="text-xs text-gray-500 mt-1">
									{b.total_applications ?? 0} applications
								</p>
							</button>
						))
					)}
				</div>

				{/* Batch detail */}
				{selectedBatch && (
					<div className="lg:col-span-2 space-y-4">
						<div className="bg-white border border-gray-200 rounded-xl p-5">
							<div className="flex items-start justify-between gap-4">
								<div>
									<h2 className="text-lg font-bold">{months(selectedBatch.batch_month)}</h2>
									<p className="text-sm text-gray-500 mt-0.5">
										Cut-off: {new Date(selectedBatch.cutoff_at).toLocaleString('en-ZA')}
									</p>
								</div>
								<span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOUR[selectedBatch.status] ?? 'bg-gray-100'}`}>
									{selectedBatch.status.replace(/_/g, ' ')}
								</span>
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
								<Stat label="Total" value={selectedBatch.total_applications ?? 0} />
								<Stat label="Valid" value={selectedBatch.valid_applications ?? 0} />
								<Stat label="Cancelled" value={selectedBatch.cancelled_applications ?? 0} />
								<Stat label="Rejected" value={selectedBatch.rejected_applications ?? 0} />
							</div>

							{selectedBatch.status === 'awaiting_approval' && (
								<div className="mt-4 pt-4 border-t border-gray-100">
									{approveError && (
										<p className="text-sm text-red-600 mb-2">{approveError}</p>
									)}
									<button
										onClick={approveBatch}
										disabled={approving}
										className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
									>
										{approving ? 'Approving…' : 'Approve batch & generate orders'}
									</button>
								</div>
							)}

							{selectedBatch.approved_at && (
								<p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
									Approved {new Date(selectedBatch.approved_at).toLocaleDateString('en-ZA')}
								</p>
							)}
						</div>

						{/* Applications table */}
						<div>
							<h3 className="font-semibold text-sm mb-2">Applications ({applications.length})</h3>
							{applications.length === 0 ? (
								<p className="text-sm text-gray-500">No applications in this batch.</p>
							) : (
								<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead className="bg-gray-50 border-b border-gray-200">
												<tr>
													<th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Name</th>
													<th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Phone</th>
													<th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Term</th>
													<th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-gray-100">
												{applications.map((a) => (
													<tr key={a.id}>
														<td className="px-4 py-3">
															<p className="font-medium">{a.display_name}</p>
															<p className="text-xs text-gray-500">{a.place_of_work}</p>
														</td>
														<td className="px-4 py-3 text-gray-700">
															{a.phone_models?.model_name ?? '—'}
														</td>
														<td className="px-4 py-3 text-gray-700">
															{a.rental_term === 0 ? 'Cash' : `${a.rental_term}m`}
														</td>
														<td className="px-4 py-3">
															<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${APP_STATUS_COLOUR[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
																{a.status.replace(/_/g, ' ')}
															</span>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div>
			<p className="text-xs text-gray-500">{label}</p>
			<p className="text-xl font-bold">{value}</p>
		</div>
	);
}
