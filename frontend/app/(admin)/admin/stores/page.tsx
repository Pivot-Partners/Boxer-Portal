'use client';

import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '@/lib/api';

type StoreCategory =
	| 'supermarket_mini'
	| 'liquor'
	| 'build'
	| 'distribution_center'
	| 'meat_factory'
	| 'head_office';

interface Store {
	id: string;
	category: StoreCategory;
	name: string;
	store_code: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

const CATEGORY_LABELS: Record<StoreCategory, string> = {
	supermarket_mini: 'Supermarket / Mini',
	liquor: 'Liquor',
	build: 'Build',
	distribution_center: 'Distribution Center',
	meat_factory: 'Meat Factory',
	head_office: 'Head Office',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as StoreCategory[];

export default function StoresPage() {
	const [stores, setStores] = useState<Store[]>([]);
	const [loading, setLoading] = useState(true);
	const [includeInactive, setIncludeInactive] = useState(false);
	const [categoryFilter, setCategoryFilter] = useState<StoreCategory | ''>('');
	const [search, setSearch] = useState('');

	const [page, setPage] = useState(1);
	const PAGE_SIZE = 20;

	const [panel, setPanel] = useState<'add' | 'edit' | 'upload' | null>(null);
	const [editStore, setEditStore] = useState<Store | null>(null);

	async function loadStores(inactive = includeInactive) {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (inactive) params.set('include_inactive', 'true');
			const res = await api<{ data: Store[] }>(`/m1/stores/admin?${params}`);
			setStores(res.data ?? []);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadStores();
	}, []);

	async function toggleInactive(next: boolean) {
		setIncludeInactive(next);
		setPage(1);
		await loadStores(next);
	}

	function openEdit(store: Store) {
		setEditStore(store);
		setPanel('edit');
	}

	function closePanel() {
		setPanel(null);
		setEditStore(null);
	}

	// Client-side filter
	const filtered = stores.filter((s) => {
		if (categoryFilter && s.category !== categoryFilter) return false;
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			return s.name.toLowerCase().includes(q) || (s.store_code ?? '').toLowerCase().includes(q);
		}
		return true;
	});

	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

	// Stats — always computed from active stores regardless of inactive toggle
	const activeStores = stores.filter((s) => s.is_active);
	const statsByCategory = CATEGORIES.map((cat) => ({
		cat,
		count: activeStores.filter((s) => s.category === cat).length,
	}));

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Stores</h1>
					<p className="text-gray-500 text-sm mt-0.5">{activeStores.length} active stores</p>
				</div>
				<div className="flex gap-2">
					<button
						onClick={() => setPanel('upload')}
						className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
					>
						Upload CSV / Excel
					</button>
					<button
						onClick={() => setPanel('add')}
						className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
					>
						Add store
					</button>
				</div>
			</div>

			{/* Category stats */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
				{statsByCategory.map(({ cat, count }) => (
					<button
						key={cat}
						onClick={() => { setCategoryFilter((prev) => (prev === cat ? '' : cat)); setPage(1); }}
						className={`rounded-xl border p-3 text-left transition-colors ${
							categoryFilter === cat
								? 'border-gray-900 bg-gray-900 text-white'
								: 'border-gray-200 bg-white hover:border-gray-300'
						}`}
					>
						<p className={`text-xs font-medium truncate ${categoryFilter === cat ? 'text-gray-300' : 'text-gray-500'}`}>
							{CATEGORY_LABELS[cat]}
						</p>
						<p className="text-xl font-bold mt-0.5">{count}</p>
					</button>
				))}
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-3 items-center">
				<select
					value={categoryFilter}
					onChange={(e) => { setCategoryFilter(e.target.value as StoreCategory | ''); setPage(1); }}
					className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
				>
					<option value="">All categories</option>
					{CATEGORIES.map((cat) => (
						<option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
					))}
				</select>

				<input
					type="text"
					placeholder="Search name or code…"
					value={search}
					onChange={(e) => { setSearch(e.target.value); setPage(1); }}
					className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]"
				/>

				<label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
					<input
						type="checkbox"
						checked={includeInactive}
						onChange={(e) => toggleInactive(e.target.checked)}
						className="rounded"
					/>
					Show inactive
				</label>
			</div>

			{/* Table */}
			<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
				{loading ? (
					<div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
				) : filtered.length === 0 ? (
					<div className="flex items-center justify-center h-32 text-gray-400 text-sm">No stores found</div>
				) : (
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-gray-200 bg-gray-50">
								<th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Code</th>
								<th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{paginated.map((store) => (
								<StoreRow
									key={store.id}
									store={store}
									onEdit={openEdit}
									onToggle={async () => {
										await api(`/m1/stores/${store.id}`, {
											method: 'PATCH',
											body: { is_active: !store.is_active },
										});
										await loadStores();
									}}
								/>
							))}
						</tbody>
					</table>
				)}
			</div>

			<div className="flex items-center justify-between text-xs text-gray-500">
				<span>
					{filtered.length === 0
						? 'No stores'
						: `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} stores`}
				</span>
				{totalPages > 1 && (
					<div className="flex items-center gap-1">
						<button
							disabled={safePage === 1}
							onClick={() => setPage((p) => p - 1)}
							className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						>
							←
						</button>
						<span className="px-2">
							Page {safePage} of {totalPages}
						</span>
						<button
							disabled={safePage === totalPages}
							onClick={() => setPage((p) => p + 1)}
							className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						>
							→
						</button>
					</div>
				)}
			</div>

			{/* Panels */}
			{panel === 'add' && (
				<AddStorePanel
					onClose={closePanel}
					onSaved={async () => {
						closePanel();
						await loadStores();
					}}
				/>
			)}

			{panel === 'edit' && editStore && (
				<EditStorePanel
					store={editStore}
					onClose={closePanel}
					onSaved={async () => {
						closePanel();
						await loadStores();
					}}
				/>
			)}

			{panel === 'upload' && (
				<UploadPanel
					onClose={closePanel}
					onSaved={async () => {
						closePanel();
						await loadStores();
					}}
				/>
			)}
		</div>
	);
}

function StoreRow({
	store,
	onEdit,
	onToggle,
}: {
	store: Store;
	onEdit: (s: Store) => void;
	onToggle: () => Promise<void>;
}) {
	const [toggling, setToggling] = useState(false);

	return (
		<tr className={`hover:bg-gray-50 transition-colors ${!store.is_active ? 'opacity-50' : ''}`}>
			<td className="px-4 py-3 font-medium">{store.name}</td>
			<td className="px-4 py-3 text-gray-500">{CATEGORY_LABELS[store.category]}</td>
			<td className="px-4 py-3 text-gray-500 hidden sm:table-cell font-mono text-xs">
				{store.store_code ?? <span className="text-gray-300">—</span>}
			</td>
			<td className="px-4 py-3">
				<span
					className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
						store.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
					}`}
				>
					{store.is_active ? 'Active' : 'Inactive'}
				</span>
			</td>
			<td className="px-4 py-3">
				<div className="flex items-center justify-end gap-2">
					<button
						onClick={() => onEdit(store)}
						className="text-xs text-gray-500 hover:text-gray-900 underline"
					>
						Edit
					</button>
					<button
						disabled={toggling}
						onClick={async () => {
							setToggling(true);
							try { await onToggle(); } finally { setToggling(false); }
						}}
						className="text-xs text-gray-500 hover:text-gray-900 underline disabled:opacity-40"
					>
						{store.is_active ? 'Deactivate' : 'Activate'}
					</button>
				</div>
			</td>
		</tr>
	);
}

function AddStorePanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
	const [name, setName] = useState('');
	const [category, setCategory] = useState<StoreCategory>('supermarket_mini');
	const [storeCode, setStoreCode] = useState('');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [reactivated, setReactivated] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError('');
		setReactivated(false);
		try {
			const res = await api<{ reactivated?: boolean }>('/m1/stores', {
				method: 'POST',
				body: { name: name.trim(), category, store_code: storeCode.trim() || null },
			});
			if ((res as any).reactivated) setReactivated(true);
			await onSaved();
		} catch (err: any) {
			setError(err.message ?? 'Failed to create store');
		} finally {
			setSaving(false);
		}
	}

	return (
		<SlidePanel title="Add store" onClose={onClose}>
			<form onSubmit={submit} className="space-y-4">
				<Field label="Category">
					<select
						value={category}
						onChange={(e) => setCategory(e.target.value as StoreCategory)}
						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
					>
						{CATEGORIES.map((cat) => (
							<option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
						))}
					</select>
				</Field>

				<Field label="Store name">
					<input
						type="text"
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
						placeholder="e.g. Boxer Meadowdale"
					/>
				</Field>

				<Field label="Store code (optional)">
					<input
						type="text"
						value={storeCode}
						onChange={(e) => setStoreCode(e.target.value)}
						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
						placeholder="e.g. MDW001"
					/>
				</Field>

				{error && <p className="text-sm text-red-600">{error}</p>}
				{reactivated && (
					<p className="text-sm text-amber-600">
						This store existed as inactive and has been reactivated.
					</p>
				)}

				<div className="flex gap-3 pt-2">
					<button
						type="submit"
						disabled={saving}
						className="flex-1 bg-gray-900 text-white text-sm rounded-lg py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors"
					>
						{saving ? 'Saving…' : 'Add store'}
					</button>
					<button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-sm rounded-lg py-2 hover:bg-gray-50 transition-colors">
						Cancel
					</button>
				</div>
			</form>
		</SlidePanel>
	);
}

function EditStorePanel({
	store,
	onClose,
	onSaved,
}: {
	store: Store;
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const [name, setName] = useState(store.name);
	const [category, setCategory] = useState<StoreCategory>(store.category);
	const [storeCode, setStoreCode] = useState(store.store_code ?? '');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError('');
		try {
			await api(`/m1/stores/${store.id}`, {
				method: 'PATCH',
				body: {
					name: name.trim(),
					category,
					store_code: storeCode.trim() || null,
				},
			});
			await onSaved();
		} catch (err: any) {
			setError(err.message ?? 'Failed to update store');
		} finally {
			setSaving(false);
		}
	}

	return (
		<SlidePanel title="Edit store" onClose={onClose}>
			<form onSubmit={submit} className="space-y-4">
				<Field label="Category">
					<select
						value={category}
						onChange={(e) => setCategory(e.target.value as StoreCategory)}
						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
					>
						{CATEGORIES.map((cat) => (
							<option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
						))}
					</select>
				</Field>

				<Field label="Store name">
					<input
						type="text"
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
					/>
				</Field>

				<Field label="Store code (optional)">
					<input
						type="text"
						value={storeCode}
						onChange={(e) => setStoreCode(e.target.value)}
						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
					/>
				</Field>

				{error && <p className="text-sm text-red-600">{error}</p>}

				<div className="flex gap-3 pt-2">
					<button
						type="submit"
						disabled={saving}
						className="flex-1 bg-gray-900 text-white text-sm rounded-lg py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors"
					>
						{saving ? 'Saving…' : 'Save changes'}
					</button>
					<button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-sm rounded-lg py-2 hover:bg-gray-50 transition-colors">
						Cancel
					</button>
				</div>
			</form>
		</SlidePanel>
	);
}

function UploadPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [csvCategory, setCsvCategory] = useState<StoreCategory | ''>('');
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState<{
		parsed: number;
		inserted: number;
		reactivated: number;
		skipped: number;
	} | null>(null);

	const isExcel = file?.name.toLowerCase().endsWith('.xlsx') || file?.name.toLowerCase().endsWith('.xls');
	const isCsv = file?.name.toLowerCase().endsWith('.csv');
	const needsCategorySelect = isCsv && !result;

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!file) return;
		setUploading(true);
		setError('');
		setResult(null);

		try {
			const formData = new FormData();
			formData.append('file', file);

			const qs = isCsv && csvCategory ? `?category=${encodeURIComponent(csvCategory)}` : '';
			const res = await apiUpload<{ data: { parsed: number; inserted: number; reactivated: number; skipped: number } }>(`/m1/stores/upload${qs}`, formData);
			setResult(res.data!);
		} catch (err: any) {
			setError(err.message ?? 'Upload failed');
		} finally {
			setUploading(false);
		}
	}

	return (
		<SlidePanel title="Upload stores" onClose={onClose}>
			<div className="space-y-4">
				<div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
					<p className="font-medium text-gray-700">Supported formats</p>
					<p>
						<span className="font-mono text-xs bg-white border border-gray-200 rounded px-1">.xlsx</span>{' '}
						— one sheet per category (sheet name = category label)
					</p>
					<p>
						<span className="font-mono text-xs bg-white border border-gray-200 rounded px-1">.csv</span>{' '}
						— single column <span className="font-mono text-xs">Store name</span>, select category below
					</p>
					<p className="text-xs text-gray-400 pt-1">Existing active stores are skipped. Inactive stores are reactivated. No stores are ever deleted automatically.</p>
				</div>

				<form onSubmit={submit} className="space-y-4">
					<Field label="File">
						<div
							className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
							onClick={() => fileRef.current?.click()}
						>
							{file ? (
								<div>
									<p className="text-sm font-medium">{file.name}</p>
									<p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
								</div>
							) : (
								<p className="text-sm text-gray-400">Click to select a .csv or .xlsx file</p>
							)}
						</div>
						<input
							ref={fileRef}
							type="file"
							accept=".csv,.xlsx,.xls"
							className="hidden"
							onChange={(e) => {
								setFile(e.target.files?.[0] ?? null);
								setResult(null);
								setError('');
							}}
						/>
					</Field>

					{needsCategorySelect && (
						<Field label="Category (CSV files only)">
							<select
								value={csvCategory}
								onChange={(e) => setCsvCategory(e.target.value as StoreCategory | '')}
								className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
							>
								<option value="">Select category…</option>
								{CATEGORIES.map((cat) => (
									<option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
								))}
							</select>
							<p className="text-xs text-gray-400 mt-1">
								Skip if your CSV has a <span className="font-mono">Category</span> column.
							</p>
						</Field>
					)}

					{error && <p className="text-sm text-red-600">{error}</p>}

					{result && (
						<div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1 text-sm">
							<p className="font-semibold text-green-800">Upload complete</p>
							<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-green-700 mt-2">
								<span>Rows parsed</span><span className="font-mono font-semibold">{result.parsed}</span>
								<span>Inserted</span><span className="font-mono font-semibold">{result.inserted}</span>
								<span>Reactivated</span><span className="font-mono font-semibold">{result.reactivated}</span>
								<span>Skipped (already active)</span><span className="font-mono font-semibold">{result.skipped}</span>
							</div>
						</div>
					)}

					<div className="flex gap-3 pt-2">
						{!result ? (
							<>
								<button
									type="submit"
									disabled={uploading || !file}
									className="flex-1 bg-gray-900 text-white text-sm rounded-lg py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors"
								>
									{uploading ? 'Uploading…' : 'Upload'}
								</button>
								<button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-sm rounded-lg py-2 hover:bg-gray-50 transition-colors">
									Cancel
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={onSaved}
								className="flex-1 bg-gray-900 text-white text-sm rounded-lg py-2 hover:bg-gray-700 transition-colors"
							>
								Done
							</button>
						)}
					</div>
				</form>
			</div>
		</SlidePanel>
	);
}

function SlidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
	return (
		<>
			<div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
			<div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
					<h2 className="font-semibold text-lg">{title}</h2>
					<button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
				</div>
				<div className="px-6 py-4">{children}</div>
			</div>
		</>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
			{children}
		</div>
	);
}
