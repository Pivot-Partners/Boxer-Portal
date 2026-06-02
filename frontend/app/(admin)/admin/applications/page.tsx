'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Batch {
	id: string;
	batch_month: string;
	status: string;
}

interface AppListItem {
	id: string;
	reference_number: string;
	first_name: string | null;
	last_name: string | null;
	display_name: string | null;
	place_of_work: string;
	rental_term: number;
	status: string;
	batch_id: string;
	submitted_at: string;
	admin_edited_at: string | null;
	admin_editor_name: string | null;
	batch_phone_catalogue: { model_name: string } | null;
}

interface AppDetail {
	id: string;
	reference_number: string;
	first_name: string | null;
	last_name: string | null;
	display_name: string | null;
	place_of_work: string;
	contact_number: string;
	email: string | null;
	phone_model_id: string;
	batch_catalogue_id: string;
	rental_term: number;
	status: string;
	batch_id: string;
	submitted_at: string;
	employee_number: string;
	id_number: string;
	admin_edited_at: string | null;
	admin_editor_name: string | null;
	admin_edit_notes: string | null;
	salary_band: string | null;
	eligible_model_ids: string[];
	whitelist_found: boolean;
	batch_phone_catalogue: {
		id: string;
		model_name: string;
		cash_price: number;
		upfront_amount: number;
		rental_amount_7m: number;
		rental_amount_13m: number;
	} | null;
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
}

interface EditForm {
	first_name: string;
	last_name: string;
	contact_number: string;
	email: string;
	place_of_work: string;
	phone_model_id: string;
	rental_term: 0 | 7 | 13;
	status: string;
	admin_edit_notes: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLOUR: Record<string, string> = {
	pending: 'bg-yellow-100 text-yellow-800',
	validated: 'bg-green-100 text-green-800',
	converted_to_order: 'bg-blue-100 text-blue-800',
	cancelled_by_employee: 'bg-gray-100 text-gray-600',
	cancelled_by_admin: 'bg-gray-100 text-gray-600',
	cancelled_no_whitelist: 'bg-red-100 text-red-700',
	cancelled_no_stock: 'bg-red-100 text-red-700',
	rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
	pending: 'Pending',
	validated: 'Validated',
	converted_to_order: 'Order placed',
	cancelled_by_employee: 'Cancelled by employee',
	cancelled_by_admin: 'Cancelled by admin',
	cancelled_no_whitelist: 'No whitelist match',
	cancelled_no_stock: 'Out of stock',
	rejected: 'Rejected',
};

const FILTER_STATUSES = Object.keys(STATUS_LABEL);

// ── Helpers ───────────────────────────────────────────────────────────────────

function appName(app: Pick<AppListItem, 'first_name' | 'last_name' | 'display_name'>) {
	if (app.first_name || app.last_name) return `${app.first_name ?? ''} ${app.last_name ?? ''}`.trim();
	return app.display_name ?? '-';
}

function termLabel(term: number) {
	if (term === 0) return 'Cash';
	return `${term}m`;
}

function zar(n: number) {
	return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

const fieldCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-colors';

const BAND_FLOOR: Record<string, number> = {
	'>3600': 3600, '>4400': 4400, '>6596': 6596,
	'>8796': 8796, '>13595': 13595, '>17196': 17196,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
	const [batches, setBatches] = useState<Batch[]>([]);
	const [apps, setApps] = useState<AppListItem[]>([]);
	const [batchFilter, setBatchFilter] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState('');
	const [searchInput, setSearchInput] = useState('');
	const [search, setSearch] = useState('');
	const [sortBy, setSortBy] = useState('submitted_at');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
	const [loading, setLoading] = useState(false);
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const PAGE_SIZE = 50;

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [detail, setDetail] = useState<AppDetail | null>(null);
	const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
	const [panelLoading, setPanelLoading] = useState(false);
	const [form, setForm] = useState<EditForm | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState('');
	const [saveSuccess, setSaveSuccess] = useState(false);

	// Debounce search input - reset to page 1 when it fires
	useEffect(() => {
		const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
		return () => clearTimeout(t);
	}, [searchInput]);

	function toggleSort(col: string) {
		if (sortBy === col) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortBy(col);
			setSortDir('desc');
		}
		setPage(1);
	}

	// Load batches on mount, default to most recent
	useEffect(() => {
		api<{ data: Batch[] }>('/m1/batches')
			.then((r) => {
				const list = r.data ?? [];
				setBatches(list);
				const defaultBatch = list.find((b) => b.status === 'open') ?? list[0];
				if (defaultBatch) setBatchFilter(defaultBatch.id);
			})
			.catch(() => {});
	}, []);

	// Reload applications when filters, search, sort, or page changes
	useEffect(() => {
		if (batchFilter === null) return; // wait until default batch is resolved
		setLoading(true);
		const params = new URLSearchParams();
		if (batchFilter) params.set('batch_id', batchFilter as string);
		if (statusFilter) params.set('status', statusFilter);
		if (search) params.set('search', search);
		params.set('sort_by', sortBy);
		params.set('sort_dir', sortDir);
		params.set('page', String(page));
		params.set('page_size', String(PAGE_SIZE));

		api<{ data: AppListItem[]; total: number }>(`/m1/applications?${params.toString()}`)
			.then((r) => { setApps(r.data ?? []); setTotal(r.total ?? 0); })
			.catch(() => { setApps([]); setTotal(0); })
			.finally(() => setLoading(false));
	}, [batchFilter, statusFilter, search, sortBy, sortDir, page]);

	async function openPanel(id: string) {
		if (selectedId === id) { setSelectedId(null); return; }
		setSelectedId(id);
		setSaveSuccess(false);
		setSaveError('');
		setPanelLoading(true);
		setDetail(null);
		setForm(null);
		setCatalogue([]);

		try {
			const res = await api<{ data: AppDetail }>(`/m1/applications/${id}`);
			const app = res.data;
			setDetail(app);

			// Split display_name as fallback when first/last name not stored yet
			const parts = (app.display_name ?? '').trim().split(/\s+/);
			const fallbackFirst = parts.length > 1 ? parts.slice(0, -1).join(' ') : (parts[0] ?? '');
			const fallbackLast = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';

			setForm({
				first_name: app.first_name ?? fallbackFirst,
				last_name: app.last_name ?? fallbackLast,
				contact_number: app.contact_number ?? '',
				email: app.email ?? '',
				place_of_work: app.place_of_work ?? '',
				phone_model_id: app.phone_model_id ?? '',
				rental_term: (app.rental_term ?? 7) as 0 | 7 | 13,
				status: app.status,
				admin_edit_notes: app.admin_edit_notes ?? '',
			});

			if (app.batch_id) {
				const catRes = await api<{ data: CatalogueEntry[] }>(`/m1/batches/${app.batch_id}/catalogue`);
				const eligibleIds = app.eligible_model_ids ?? [];
				setCatalogue(
					(catRes.data ?? []).filter((e) =>
						e.is_available &&
						(eligibleIds.length === 0 || eligibleIds.includes(e.source_model_id))
					)
				);
			}
		} catch {
			// panel shows error state
		} finally {
			setPanelLoading(false);
		}
	}

	async function save() {
		if (!selectedId || !form) return;
		setSaving(true);
		setSaveError('');
		setSaveSuccess(false);
		try {
			await api(`/m1/applications/${selectedId}`, { method: 'PATCH', body: form });
			setSaveSuccess(true);
			// Refresh detail so the "admin edited" banner reflects current state
			const res = await api<{ data: AppDetail }>(`/m1/applications/${selectedId}`);
			setDetail(res.data);
			// Update name + edited marker in list
			setApps((prev) => prev.map((a) =>
				a.id !== selectedId ? a : {
					...a,
					first_name: form.first_name || a.first_name,
					last_name: form.last_name || a.last_name,
					place_of_work: form.place_of_work || a.place_of_work,
					rental_term: form.rental_term,
					status: form.status,
					admin_edited_at: new Date().toISOString(),
					admin_editor_name: res.data.admin_editor_name,
				}
			));
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
		} finally {
			setSaving(false);
		}
	}

	const panelOpen = selectedId !== null;

	return (
		<div className={`flex gap-6 ${panelOpen ? 'lg:items-start' : ''}`}>
			{/* ── Table ── */}
			<div className={`flex-1 min-w-0 space-y-4 ${panelOpen ? 'hidden lg:block' : ''}`}>
				<div className="flex items-center justify-between">
					<h1 className="text-xl font-bold">Applications</h1>
					<span className="text-sm text-gray-400">
						{total === 0 ? '0 records' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
					</span>
				</div>

				{/* Filters */}
				<div className="flex flex-wrap gap-3">
					<div className="relative">
						<svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
							<circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
						</svg>
						<input
							type="text"
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							placeholder="Search name, reference, store…"
							className="text-sm border border-gray-300 rounded-lg pl-9 pr-8 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-slate-500"
						/>
						{searchInput && (
							<button
								onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
							>
								×
							</button>
						)}
					</div>
					<select
						value={batchFilter ?? ''}
						onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}
						className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
					>
						<option value="">All batches</option>
						{batches.map((b) => (
							<option key={b.id} value={b.id}>
								{new Date(b.batch_month).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
								{' - '}{b.status}
							</option>
						))}
					</select>
					<select
						value={statusFilter}
						onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
						className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
					>
						<option value="">All statuses</option>
						{FILTER_STATUSES.map((s) => (
							<option key={s} value={s}>{STATUS_LABEL[s]}</option>
						))}
					</select>
				</div>

				{/* Table */}
				<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
					{loading ? (
						<div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading…</div>
					) : apps.length === 0 ? (
						<div className="flex items-center justify-center h-48 text-gray-400 text-sm">No applications found</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-gray-200 bg-gray-50 text-left">
										<SortTh label="Reference" col="reference_number" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
										<SortTh label="Name" col="display_name" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
										<th className="px-4 py-3 font-medium text-gray-600">Phone</th>
										<SortTh label="Term" col="rental_term" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
										<SortTh label="Place of work" col="place_of_work" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
										<SortTh label="Status" col="status" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
										<SortTh label="Submitted" col="submitted_at" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100">
									{apps.map((app) => (
										<tr
											key={app.id}
											onClick={() => openPanel(app.id)}
											className={`cursor-pointer transition-colors hover:bg-gray-50 ${selectedId === app.id ? 'bg-slate-50' : ''}`}
										>
											<td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{app.reference_number}</td>
											<td className="px-4 py-3">
												<span className="font-medium text-gray-900">{appName(app)}</span>
												{app.admin_edited_at && (
													<span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">edited</span>
												)}
											</td>
											<td className="px-4 py-3 text-gray-700 whitespace-nowrap">{app.batch_phone_catalogue?.model_name ?? '-'}</td>
											<td className="px-4 py-3 text-gray-600">{termLabel(app.rental_term)}</td>
											<td className="px-4 py-3 text-gray-600 max-w-[180px] truncate hidden xl:table-cell">{app.place_of_work}</td>
											<td className="px-4 py-3 whitespace-nowrap">
												<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOUR[app.status] ?? 'bg-gray-100 text-gray-600'}`}>
													{STATUS_LABEL[app.status] ?? app.status}
												</span>
											</td>
											<td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap hidden md:table-cell">
												{new Date(app.submitted_at).toLocaleDateString('en-ZA')}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Pagination */}
				{total > PAGE_SIZE && (
					<div className="flex items-center justify-between">
						<button
							disabled={page === 1}
							onClick={() => setPage((p) => p - 1)}
							className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
						>
							← Previous
						</button>
						<span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
						<button
							disabled={page * PAGE_SIZE >= total}
							onClick={() => setPage((p) => p + 1)}
							className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
						>
							Next →
						</button>
					</div>
				)}
			</div>

			{/* ── Detail / edit panel ── */}
			{panelOpen && (
				<div className="w-full lg:w-[420px] lg:shrink-0">
					<DetailPanel
						detail={detail}
						form={form}
						catalogue={catalogue}
						loading={panelLoading}
						saving={saving}
						saveError={saveError}
						saveSuccess={saveSuccess}
						onChange={(updates) => setForm((f) => f ? { ...f, ...updates } : f)}
						onSave={save}
						onClose={() => setSelectedId(null)}
					/>
				</div>
			)}
		</div>
	);
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
	detail,
	form,
	catalogue,
	loading,
	saving,
	saveError,
	saveSuccess,
	onChange,
	onSave,
	onClose,
}: {
	detail: AppDetail | null;
	form: EditForm | null;
	catalogue: CatalogueEntry[];
	loading: boolean;
	saving: boolean;
	saveError: string;
	saveSuccess: boolean;
	onChange: (updates: Partial<EditForm>) => void;
	onSave: () => void;
	onClose: () => void;
}) {
	if (loading) {
		return (
			<div className="bg-white border border-gray-200 rounded-xl flex items-center justify-center h-64 text-gray-400 text-sm">
				Loading…
			</div>
		);
	}

	if (!detail || !form) {
		return (
			<div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500 space-y-3">
				<p>Could not load application details.</p>
				<button onClick={onClose} className="text-slate-800 hover:text-slate-900 font-medium">← Back to list</button>
			</div>
		);
	}

	const selectedCat = catalogue.find((c) => c.source_model_id === form.phone_model_id);
	const salaryFloor = detail.salary_band ? (BAND_FLOOR[detail.salary_band] ?? 0) : 0;
	const canCash = selectedCat ? salaryFloor >= selectedCat.cash_price * 4 : false;

	return (
		<div className="bg-white border border-gray-200 rounded-xl overflow-hidden sticky top-4">
			{/* Header */}
			<div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 flex-wrap min-w-0">
					<span className="font-mono text-sm font-semibold text-gray-900 truncate">{detail.reference_number}</span>
					<span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOUR[detail.status] ?? 'bg-gray-100 text-gray-600'}`}>
						{STATUS_LABEL[detail.status] ?? detail.status}
					</span>
					{detail.admin_edited_at && (
						<span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
							Admin edited
						</span>
					)}
				</div>
				<button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
			</div>

			<div className="p-5 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
				{/* Admin edit history */}
				{detail.admin_edited_at && (
					<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
						<p>
							<span className="font-semibold">Edited by {detail.admin_editor_name ?? 'Admin'}</span>
							{' on '}
							{new Date(detail.admin_edited_at).toLocaleString('en-ZA')}
						</p>
						{detail.admin_edit_notes && <p className="text-amber-700">"{detail.admin_edit_notes}"</p>}
					</div>
				)}

				{/* Read-only: application info */}
				<section className="space-y-2">
					<SectionLabel>Application info</SectionLabel>
					<ReadRow label="Submitted" value={new Date(detail.submitted_at).toLocaleString('en-ZA')} />
					<ReadRow label="Employee number" value={detail.employee_number || '-'} mono />
					<ReadRow label="ID number" value={detail.id_number || '-'} mono />
					<ReadRow label="Salary band" value={detail.salary_band ?? (detail.whitelist_found ? 'No salary band set' : 'Not in whitelist')} />
				</section>

				{/* Eligibility summary */}
				{detail.salary_band && (
					<div className={`p-3 rounded-lg text-xs border ${
						detail.eligible_model_ids.length === 0
							? 'bg-red-50 border-red-200 text-red-700'
							: 'bg-blue-50 border-blue-200 text-blue-700'
					}`}>
						<span className="font-semibold">Salary eligibility: </span>
						{detail.eligible_model_ids.length === 0
							? 'No phone models qualify for this salary band.'
							: `${detail.eligible_model_ids.length} phone model(s) available. Cash purchase requires salary ≥ R ${((selectedCat?.cash_price ?? 0) * 4).toLocaleString('en-ZA')}.`
						}
					</div>
				)}
				{!detail.whitelist_found && (
					<div className="p-3 rounded-lg text-xs border bg-amber-50 border-amber-200 text-amber-700">
						<span className="font-semibold">Warning: </span>
						Employee not found in current whitelist - eligibility rules cannot be verified.
					</div>
				)}
				{detail.whitelist_found && !detail.salary_band && (
					<div className="p-3 rounded-lg text-xs border bg-amber-50 border-amber-200 text-amber-700">
						<span className="font-semibold">Note: </span>
						Employee is in the whitelist but has no salary band recorded - not eligible for the phone scheme.
					</div>
				)}

				{/* Editable: name + contact */}
				<section className="space-y-3">
					<SectionLabel>Employee details</SectionLabel>
					<div className="grid grid-cols-2 gap-3">
						<Field label="First name">
							<input
								type="text"
								value={form.first_name}
								onChange={(e) => onChange({ first_name: e.target.value })}
								className={fieldCls}
							/>
						</Field>
						<Field label="Last name">
							<input
								type="text"
								value={form.last_name}
								onChange={(e) => onChange({ last_name: e.target.value })}
								className={fieldCls}
							/>
						</Field>
					</div>
					<Field label="Contact number">
						<input
							type="tel"
							value={form.contact_number}
							onChange={(e) => onChange({ contact_number: e.target.value })}
							className={fieldCls}
						/>
					</Field>
					<Field label="Email">
						<input
							type="email"
							value={form.email}
							onChange={(e) => onChange({ email: e.target.value })}
							className={fieldCls}
						/>
					</Field>
				</section>

				{/* Editable: application details */}
				<section className="space-y-3">
					<SectionLabel>Application details</SectionLabel>
					<Field label="Status">
						<select
							value={form.status}
							onChange={(e) => onChange({ status: e.target.value })}
							className={fieldCls}
						>
							<option value="pending">Pending</option>
							<option value="validated">Validated</option>
							<option value="converted_to_order">Order placed</option>
							<option value="cancelled_by_employee">Cancelled by employee</option>
							<option value="cancelled_by_admin">Cancelled by admin</option>
							<option value="cancelled_no_whitelist">Cancelled - no whitelist match</option>
							<option value="cancelled_no_stock">Cancelled - out of stock</option>
							<option value="rejected">Rejected</option>
						</select>
					</Field>
					<Field label="Place of work">
						<input
							type="text"
							value={form.place_of_work}
							onChange={(e) => onChange({ place_of_work: e.target.value })}
							className={fieldCls}
						/>
					</Field>

					{catalogue.length > 0 ? (
						<Field label="Phone model">
							<select
								value={form.phone_model_id}
								onChange={(e) => onChange({ phone_model_id: e.target.value })}
								className={fieldCls}
							>
								{catalogue.map((c) => (
									<option key={c.source_model_id} value={c.source_model_id}>
										{c.model_name}
									</option>
								))}
							</select>
							{detail.salary_band && (
								<p className="text-xs text-gray-400 mt-1">
									Filtered to models eligible for <span className="font-medium">{detail.salary_band}</span> salary band.
								</p>
							)}
						</Field>
					) : (
						<div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
							No available phones match this employee's salary band ({detail.salary_band ?? 'unknown'}).
						</div>
					)}

					<Field label="Payment term">
						<div className="flex gap-2">
							{([0, 7, 13] as const).map((term) => {
								const cashBlocked = term === 0 && !canCash && !!detail.salary_band;
								return (
									<button
										key={term}
										type="button"
										disabled={cashBlocked}
										onClick={() => !cashBlocked && onChange({ rental_term: term })}
										title={cashBlocked ? `Cash requires salary ≥ R ${((selectedCat?.cash_price ?? 0) * 4).toLocaleString('en-ZA')}` : undefined}
										className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
											cashBlocked
												? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
												: form.rental_term === term
												? 'border-slate-800 bg-slate-50 text-slate-900'
												: 'border-gray-200 text-gray-600 hover:border-gray-300'
										}`}
									>
										{term === 0 ? 'Cash' : `${term}m`}
									</button>
								);
							})}
						</div>
						{selectedCat && (
							<p className="text-xs text-gray-500 mt-1.5">
								{form.rental_term === 0 && `${zar(selectedCat.cash_price)} deducted once`}
								{form.rental_term === 7 && `First: ${zar(selectedCat.upfront_amount)}, then ${zar(selectedCat.rental_amount_7m)}/month × 6`}
								{form.rental_term === 13 && `First: ${zar(selectedCat.upfront_amount)}, then ${zar(selectedCat.rental_amount_13m)}/month × 12`}
							</p>
						)}
						{!canCash && !!detail.salary_band && selectedCat && (
							<p className="text-xs text-amber-600 mt-1">
								Cash purchase not available - requires monthly salary ≥ {zar(selectedCat.cash_price * 4)}.
							</p>
						)}
					</Field>
				</section>

				{/* Admin notes */}
				<section className="space-y-3">
					<SectionLabel>Admin note</SectionLabel>
					<textarea
						value={form.admin_edit_notes}
						onChange={(e) => onChange({ admin_edit_notes: e.target.value })}
						placeholder="Reason for edit (recommended)"
						rows={3}
						className={`${fieldCls} resize-none`}
					/>
				</section>

				{saveError && (
					<div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
						{saveError}
					</div>
				)}

				{saveSuccess && (
					<div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
						Changes saved successfully.
					</div>
				)}

				<button
					onClick={onSave}
					disabled={saving}
					className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
				>
					{saving ? 'Saving…' : 'Save changes'}
				</button>
				<button
					onClick={onClose}
					disabled={saving}
					className="w-full py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-600 font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

// ── Small components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
	return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
			{children}
		</div>
	);
}

function ReadRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
	return (
		<div className="flex justify-between gap-3 py-0.5">
			<span className="text-xs text-gray-500 shrink-0">{label}</span>
			<span className={`text-xs text-right text-gray-900 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
		</div>
	);
}

function SortTh({ label, col, sortBy, sortDir, onSort, className }: {
	label: string; col: string; sortBy: string; sortDir: 'asc' | 'desc';
	onSort: (col: string) => void; className?: string;
}) {
	const active = sortBy === col;
	return (
		<th
			onClick={() => onSort(col)}
			className={`px-4 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:text-gray-900 hover:bg-gray-100 transition-colors ${className ?? ''}`}
		>
			<span className="inline-flex items-center gap-1">
				{label}
				<span className={`text-xs leading-none ${active ? 'text-slate-700' : 'text-gray-300'}`}>
					{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
				</span>
			</span>
		</th>
	);
}
