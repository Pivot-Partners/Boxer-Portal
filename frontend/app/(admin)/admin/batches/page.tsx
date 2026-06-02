'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Batch {
	id: string;
	batch_month: string;
	cutoff_at: string;
	status: string;
	total_applications: number;
	pending_applications: number;
	valid_applications: number;
	cancelled_applications: number;
	rejected_applications: number;
	approved_at: string | null;
	approved_by: string | null;
	processing_log: { ts: string; message: string }[];
}

interface ClosePreview {
	pending_count: number;
	on_whitelist: number;
	not_on_whitelist: number;
}

interface BatchStats {
	total: number;
	by_phone: { name: string; count: number }[];
	by_term: { name: string; count: number }[];
	top_stores: { name: string; count: number }[];
}

interface Application {
	id: string;
	reference_number: string;
	display_name: string;
	place_of_work: string;
	rental_term: number;
	status: string;
	submitted_at: string;
	batch_phone_catalogue: { model_name: string } | null;
}

interface CatalogueEntry {
	id: string;
	source_model_id: string;
	model_name: string;
	cash_price: number;
	upfront_amount: number;
	rental_amount_7m: number;
	rental_amount_13m: number;
	is_available: boolean;
	display_order: number;
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

function zar(n: number) {
	return `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function months(date: string) {
	return new Date(date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const EXPORTABLE_STATUSES = new Set(['awaiting_approval', 'approved', 'orders_submitted', 'completed']);

export default function BatchesPage() {
	const [batches, setBatches] = useState<Batch[]>([]);
	const [applications, setApplications] = useState<Application[]>([]);
	const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
	const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
	const [loading, setLoading] = useState(true);

	const [approving, setApproving] = useState(false);
	const [approveError, setApproveError] = useState('');
	const [closing, setClosing] = useState(false);
	const [closeError, setCloseError] = useState('');
	const [seeding, setSeeding] = useState(false);
	const [seedError, setSeedError] = useState('');
	const [seedSuccess, setSeedSuccess] = useState('');
	const [togglingId, setTogglingId] = useState<string | null>(null);
	const [preview, setPreview] = useState<ClosePreview | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [stats, setStats] = useState<BatchStats | null>(null);
	const [statsLoading, setStatsLoading] = useState(false);
	const [logOpen, setLogOpen] = useState(false);

	const [openForm, setOpenForm] = useState(false);
	const [newMonth, setNewMonth] = useState('');
	const [newCutoff, setNewCutoff] = useState('');
	const [opening, setOpening] = useState(false);
	const [openError, setOpenError] = useState('');

	async function fetchBatches() {
		const res = await api<{ data: Batch[] }>('/m1/batches');
		const raw = res.data ?? [];
		const list = [...raw].sort((a, b) => {
			if (a.status === 'open' && b.status !== 'open') return -1;
			if (b.status === 'open' && a.status !== 'open') return 1;
			return 0;
		});
		setBatches(list);
		if (selectedBatch) {
			const updated = list.find((b) => b.id === selectedBatch.id);
			if (updated) setSelectedBatch(updated);
		} else if (list.length > 0) {
			setSelectedBatch(list.find((b) => b.status === 'open') ?? list[0]!);
		}
	}

	async function fetchApplications(batchId: string) {
		try {
			const res = await api<{ data: Application[] }>(`/m1/applications?batch_id=${batchId}`);
			setApplications(res.data ?? []);
		} catch {
			setApplications([]);
		}
	}

	async function fetchCatalogue(batchId: string) {
		try {
			const res = await api<{ data: CatalogueEntry[] }>(`/m1/batches/${batchId}/catalogue`);
			setCatalogue(res.data ?? []);
		} catch {
			setCatalogue([]);
		}
	}

	useEffect(() => {
		fetchBatches().finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		if (selectedBatch) {
			fetchApplications(selectedBatch.id);
			fetchCatalogue(selectedBatch.id);
			fetchStats(selectedBatch.id);
			setSeedError('');
			setSeedSuccess('');
			setPreview(null);
			setLogOpen(false);
		}
	}, [selectedBatch?.id]);

	async function loadPreview() {
		if (!selectedBatch) return;
		setPreviewLoading(true);
		try {
			const res = await api<{ data: ClosePreview }>(`/m1/batches/${selectedBatch.id}/preview`);
			setPreview(res.data);
		} catch {
			setCloseError('Could not load preview');
		} finally {
			setPreviewLoading(false);
		}
	}

	async function fetchStats(batchId: string) {
		setStatsLoading(true);
		try {
			const res = await api<{ data: BatchStats }>(`/m1/batches/${batchId}/stats`);
			setStats(res.data);
		} catch {
			setStats(null);
		} finally {
			setStatsLoading(false);
		}
	}

	async function closeBatch() {
		if (!selectedBatch) return;
		setClosing(true);
		setCloseError('');
		try {
			await api(`/m1/batches/${selectedBatch.id}/close`, { method: 'POST' });
			await fetchBatches();
		} catch (err) {
			setCloseError(err instanceof Error ? err.message : 'Failed to close batch');
		} finally {
			setClosing(false);
		}
	}

	async function approveBatch() {
		if (!selectedBatch) return;
		setApproving(true);
		setApproveError('');
		try {
			await api(`/m1/batches/${selectedBatch.id}/approve`, { method: 'POST' });
			await Promise.all([fetchBatches(), fetchApplications(selectedBatch.id)]);
		} catch (err) {
			setApproveError(err instanceof Error ? err.message : 'Approval failed');
		} finally {
			setApproving(false);
		}
	}

	async function seedCatalogue() {
		if (!selectedBatch) return;
		setSeeding(true);
		setSeedError('');
		setSeedSuccess('');
		try {
			const res = await api<{ data: { seeded: number } }>(`/m1/batches/${selectedBatch.id}/catalogue/seed`, { method: 'POST' });
			setSeedSuccess(`Catalogue seeded - ${res.data?.seeded ?? 0} phone model(s) added.`);
			await fetchCatalogue(selectedBatch.id);
		} catch (err) {
			setSeedError(err instanceof Error ? err.message : 'Seed failed');
		} finally {
			setSeeding(false);
		}
	}

	async function toggleAvailability(entry: CatalogueEntry) {
		if (!selectedBatch) return;
		setTogglingId(entry.id);
		try {
			await api(`/m1/batches/${selectedBatch.id}/catalogue/${entry.id}`, {
				method: 'PATCH',
				body: { is_available: !entry.is_available },
			});
			await fetchCatalogue(selectedBatch.id);
		} finally {
			setTogglingId(null);
		}
	}

	async function openBatch(e: React.FormEvent) {
		e.preventDefault();
		setOpening(true);
		setOpenError('');
		try {
			await api('/m1/batches', {
				method: 'POST',
				body: { batch_month: newMonth + '-01', cutoff_at: new Date(newCutoff).toISOString() },
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
						className="shrink-0 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors"
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
								className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Cut-off date & time</label>
							<input
								type="datetime-local"
								value={newCutoff}
								onChange={(e) => setNewCutoff(e.target.value)}
								required
								className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
							/>
						</div>
					</div>
					{openError && <p className="text-sm text-red-600">{openError}</p>}
					<div className="flex gap-3">
						<button
							type="submit"
							disabled={opening}
							className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
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
										? 'border-slate-500 bg-slate-50'
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
						{/* Batch summary card */}
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
								<Stat label="Pending" value={selectedBatch.pending_applications ?? 0} />
								<Stat label="Cancelled" value={selectedBatch.cancelled_applications ?? 0} />
								<Stat label="Rejected" value={selectedBatch.rejected_applications ?? 0} />
							</div>

							{selectedBatch.status === 'open' && (
								<div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
									{!preview ? (
										<>
											{closeError && <p className="text-sm text-red-600">{closeError}</p>}
											<button
												onClick={loadPreview}
												disabled={previewLoading}
												className="px-5 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
											>
												{previewLoading ? 'Loading preview…' : 'Close batch'}
											</button>
											<p className="text-xs text-gray-400">Preview before confirming.</p>
										</>
									) : (
										<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
											<p className="text-sm font-semibold text-amber-900">Close batch — review before confirming</p>
											<div className="grid grid-cols-3 gap-3 text-center">
												<div className="bg-white rounded-lg p-2 border border-amber-100">
													<p className="text-xs text-gray-500">Pending</p>
													<p className="text-xl font-bold text-gray-900">{preview.pending_count}</p>
												</div>
												<div className="bg-white rounded-lg p-2 border border-green-100">
													<p className="text-xs text-gray-500">On whitelist</p>
													<p className="text-xl font-bold text-green-700">{preview.on_whitelist}</p>
												</div>
												<div className="bg-white rounded-lg p-2 border border-red-100">
													<p className="text-xs text-gray-500">Not on whitelist</p>
													<p className="text-xl font-bold text-red-600">{preview.not_on_whitelist}</p>
												</div>
											</div>
											{preview.not_on_whitelist > 0 && (
												<p className="text-xs text-amber-800">
													{preview.not_on_whitelist} employee{preview.not_on_whitelist > 1 ? 's are' : ' is'} no longer on the current whitelist. Consider uploading a fresh whitelist before closing.
												</p>
											)}
											{closeError && <p className="text-sm text-red-600">{closeError}</p>}
											<div className="flex gap-3">
												<button
													onClick={closeBatch}
													disabled={closing}
													className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
												>
													{closing ? 'Closing…' : 'Confirm close'}
												</button>
												<button onClick={() => setPreview(null)} disabled={closing} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors">
													Cancel
												</button>
											</div>
										</div>
									)}
								</div>
							)}

							{selectedBatch.status === 'awaiting_approval' && (
								<div className="mt-4 pt-4 border-t border-gray-100">
									{approveError && <p className="text-sm text-red-600 mb-2">{approveError}</p>}
									<button
										onClick={approveBatch}
										disabled={approving}
										className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
									>
										{approving ? 'Approving…' : 'Approve batch & generate orders'}
									</button>
								</div>
							)}

							{EXPORTABLE_STATUSES.has(selectedBatch.status) && (selectedBatch.total_applications ?? 0) > 0 && (
								<div className="mt-4 pt-4 border-t border-gray-100">
									<a
										href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/m1/batches/${selectedBatch.id}/export`}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg transition-colors"
									>
										Download HR Export (.xlsx)
									</a>
									<p className="text-xs text-gray-400 mt-1">Password-protected Excel for HR payroll deductions.</p>
								</div>
							)}

							{selectedBatch.approved_at && (
								<p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
									Approved {new Date(selectedBatch.approved_at).toLocaleDateString('en-ZA')}
								</p>
							)}

							{(selectedBatch.processing_log?.length ?? 0) > 0 && (
								<div className="mt-4 pt-4 border-t border-gray-100">
									<button
										onClick={() => setLogOpen(!logOpen)}
										className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-800"
									>
										<svg className={`w-3.5 h-3.5 transition-transform ${logOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
										</svg>
										Processing log ({selectedBatch.processing_log.length} entries)
									</button>
									{logOpen && (
										<div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
											{selectedBatch.processing_log.map((entry, i) => (
												<div key={i} className="flex gap-3 text-xs">
													<span className="text-gray-400 shrink-0 font-mono">
														{new Date(entry.ts).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
													</span>
													<span className="text-gray-700">{entry.message}</span>
												</div>
											))}
										</div>
									)}
								</div>
							)}
						</div>

						{/* Phone catalogue for this batch */}
						<div className="bg-white border border-gray-200 rounded-xl p-5">
							<div className="flex items-center justify-between gap-4 mb-4">
								<div>
									<h3 className="font-semibold">Phone Catalogue</h3>
									<p className="text-xs text-gray-500 mt-0.5">
										Prices locked to this batch. Toggle availability to hide a model from employees.
									</p>
								</div>
								<button
									onClick={seedCatalogue}
									disabled={seeding || selectedBatch?.status !== 'open'}
									className="shrink-0 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
								>
									{seeding ? 'Seeding…' : catalogue.length === 0 ? 'Seed catalogue' : 'Re-sync from master'}
								</button>
							</div>

							{seedError && <p className="text-sm text-red-600 mb-3">{seedError}</p>}
							{seedSuccess && <p className="text-sm text-green-600 mb-3">{seedSuccess}</p>}

							{catalogue.length === 0 ? (
								<div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
									No phone models assigned to this batch yet. Click <strong>Seed catalogue</strong> to copy the current phone models in.
								</div>
							) : (
								<div className="space-y-2">
									{catalogue.map((entry) => (
										<div
											key={entry.id}
											className={`flex items-center justify-between gap-4 p-3 rounded-lg border transition-colors ${
												entry.is_available ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
											}`}
										>
											<div className="min-w-0">
												<p className={`text-sm font-medium ${entry.is_available ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
													{entry.model_name}
												</p>
												<p className="text-xs text-gray-500 mt-0.5">
													Cash {zar(entry.cash_price)} · Upfront {zar(entry.upfront_amount)} · 7m {zar(entry.rental_amount_7m)}/mo · 13m {zar(entry.rental_amount_13m)}/mo
												</p>
											</div>
											<button
												onClick={() => toggleAvailability(entry)}
												disabled={togglingId === entry.id}
												className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
													entry.is_available
														? 'bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-700'
														: 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-800'
												}`}
											>
												{togglingId === entry.id ? '…' : entry.is_available ? 'Available' : 'Unavailable'}
											</button>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Application stats */}
						{(stats || statsLoading) && (
							<div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
								<div>
									<h3 className="font-semibold">Application breakdown</h3>
									{stats && <p className="text-xs text-gray-500 mt-0.5">{stats.total} active applications</p>}
								</div>
								{statsLoading && <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />}
								{stats && stats.total > 0 && (
									<>
										<div>
											<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">By phone model</p>
											<div className="space-y-2">
												{stats.by_phone.map(({ name, count }) => (
													<BarRow key={name} label={name} count={count} max={stats.by_phone[0]!.count} />
												))}
											</div>
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">By payment term</p>
											<div className="space-y-2">
												{stats.by_term.map(({ name, count }) => (
													<BarRow key={name} label={name} count={count} max={stats.total} />
												))}
											</div>
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top stores</p>
											<div className="space-y-2">
												{stats.top_stores.map(({ name, count }) => (
													<BarRow key={name} label={name} count={count} max={stats.top_stores[0]!.count} />
												))}
											</div>
										</div>
									</>
								)}
								{stats && stats.total === 0 && (
									<p className="text-sm text-gray-500">No active applications yet.</p>
								)}
							</div>
						)}

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
															{a.batch_phone_catalogue?.model_name ?? '-'}
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

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
	const pct = max > 0 ? Math.round((count / max) * 100) : 0;
	return (
		<div className="flex items-center gap-3">
			<span className="text-sm text-gray-600 w-44 truncate shrink-0" title={label}>{label}</span>
			<div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
				<div className="bg-slate-600 h-4 rounded-full transition-all" style={{ width: `${pct}%` }} />
			</div>
			<span className="text-sm font-medium text-gray-700 w-8 text-right shrink-0">{count}</span>
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
