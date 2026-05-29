'use client';

import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '@/lib/api';

interface StoreCategoryRecord {
	key: string;
	label: string;
	is_single_store: boolean;
	display_order: number;
	is_active: boolean;
}

interface Store {
	id: string;
	category: string;
	name: string;
	store_code: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export default function StoresPage() {
	const [stores, setStores] = useState<Store[]>([]);
	const [categories, setCategories] = useState<StoreCategoryRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [includeInactive, setIncludeInactive] = useState(false);
	const [categoryFilter, setCategoryFilter] = useState('');
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);
	const PAGE_SIZE = 20;

	const [panel, setPanel] = useState<'add' | 'edit' | 'upload' | 'categories' | null>(null);
	const [editStore, setEditStore] = useState<Store | null>(null);

	function categoryLabel(key: string): string {
		return categories.find((c) => c.key === key)?.label ?? key;
	}

	async function loadStores(inactive = includeInactive) {
		const params = new URLSearchParams();
		if (inactive) params.set('include_inactive', 'true');
		const res = await api<{ data: Store[] }>(`/m1/stores/admin?${params}`);
		setStores(res.data ?? []);
	}

	async function loadCategories() {
		const res = await api<{ data: StoreCategoryRecord[] }>('/m1/store-categories');
		setCategories(res.data ?? []);
	}

	useEffect(() => {
		setLoading(true);
		Promise.allSettled([loadStores(), loadCategories()]).finally(() => setLoading(false));
	}, []);

	async function toggleInactive(next: boolean) {
		setIncludeInactive(next);
		setPage(1);
		setLoading(true);
		try { await loadStores(next); } finally { setLoading(false); }
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

	const activeStores = stores.filter((s) => s.is_active);
	const activeCategories = categories.filter((c) => c.is_active);
	const statsByCategory = activeCategories.map((cat) => ({
		key: cat.key,
		label: cat.label,
		count: activeStores.filter((s) => s.category === cat.key).length,
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
						onClick={() => setPanel('categories')}
						className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
					>
						Manage categories
					</button>
					<button
						onClick={() => setPanel('upload')}
						className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
					>
						Upload CSV / Excel
					</button>
					<button
						onClick={() => setPanel('add')}
						className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
					>
						Add store
					</button>
				</div>
			</div>

			{/* Category stats */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
				{statsByCategory.map(({ key, label, count }) => (
					<button
						key={key}
						onClick={() => { setCategoryFilter((prev) => (prev === key ? '' : key)); setPage(1); }}
						className={`rounded-xl border p-3 text-left transition-colors ${
							categoryFilter === key
								? 'border-primary-600 bg-primary-600 text-white'
								: 'border-gray-200 bg-white hover:border-gray-300'
						}`}
					>
						<p className={`text-xs font-medium truncate ${categoryFilter === key ? 'text-white/80' : 'text-gray-500'}`}>
							{label}
						</p>
						<p className="text-xl font-bold mt-0.5">{count}</p>
					</button>
				))}
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-3 items-center">
				<select
					value={categoryFilter}
					onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
					className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
				>
					<option value="">All categories</option>
					{activeCategories.map((cat) => (
						<option key={cat.key} value={cat.key}>{cat.label}</option>
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
									categoryLabel={categoryLabel}
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
						<span className="px-2">Page {safePage} of {totalPages}</span>
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
					categories={categories}
					onClose={closePanel}
					onSaved={async () => { closePanel(); await loadStores(); }}
				/>
			)}

			{panel === 'edit' && editStore && (
				<EditStorePanel
					store={editStore}
					categories={categories}
					onClose={closePanel}
					onSaved={async () => { closePanel(); await loadStores(); }}
				/>
			)}

			{panel === 'upload' && (
				<UploadPanel
					categories={categories}
					onClose={closePanel}
					onSaved={async () => { closePanel(); await loadStores(); }}
				/>
			)}

			{panel === 'categories' && (
				<CategoriesPanel
					categories={categories}
					onClose={closePanel}
					onSaved={async () => {
						await loadCategories();
					}}
				/>
			)}
		</div>
	);
}

function StoreRow({
	store,
	categoryLabel,
	onEdit,
	onToggle,
}: {
	store: Store;
	categoryLabel: (key: string) => string;
	onEdit: (s: Store) => void;
	onToggle: () => Promise<void>;
}) {
	const [toggling, setToggling] = useState(false);

	return (
		<tr className={`hover:bg-gray-50 transition-colors ${!store.is_active ? 'opacity-50' : ''}`}>
			<td className="px-4 py-3 font-medium">{store.name}</td>
			<td className="px-4 py-3 text-gray-500">{categoryLabel(store.category)}</td>
			<td className="px-4 py-3 text-gray-500 hidden sm:table-cell font-mono text-xs">
				{store.store_code ?? <span className="text-gray-300">-</span>}
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

function AddStorePanel({
	categories,
	onClose,
	onSaved,
}: {
	categories: StoreCategoryRecord[];
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const activeCategories = categories.filter((c) => c.is_active);
	const [name, setName] = useState('');
	const [category, setCategory] = useState<string>(activeCategories[0]?.key ?? '');
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
						onChange={(e) => setCategory(e.target.value)}
						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
					>
						{activeCategories.map((cat) => (
							<option key={cat.key} value={cat.key}>{cat.label}</option>
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
						disabled={saving || !category}
						className="flex-1 bg-primary-600 text-white text-sm rounded-lg py-2 hover:bg-primary-700 disabled:opacity-50 transition-colors"
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
	categories,
	onClose,
	onSaved,
}: {
	store: Store;
	categories: StoreCategoryRecord[];
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const activeCategories = categories.filter((c) => c.is_active);
	const [name, setName] = useState(store.name);
	const [category, setCategory] = useState<string>(store.category);
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
						onChange={(e) => setCategory(e.target.value)}
						className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
					>
						{activeCategories.map((cat) => (
							<option key={cat.key} value={cat.key}>{cat.label}</option>
						))}
						{/* Include the current category even if inactive, so the select renders correctly */}
						{!activeCategories.find((c) => c.key === store.category) && (
							<option value={store.category}>{store.category} (inactive)</option>
						)}
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
						className="flex-1 bg-primary-600 text-white text-sm rounded-lg py-2 hover:bg-primary-700 disabled:opacity-50 transition-colors"
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

function UploadPanel({
	categories,
	onClose,
	onSaved,
}: {
	categories: StoreCategoryRecord[];
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [csvCategory, setCsvCategory] = useState('');
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState<{
		parsed: number;
		inserted: number;
		reactivated: number;
		skipped: number;
		unrecognized_categories: string[];
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
			const res = await apiUpload<{
				data: { parsed: number; inserted: number; reactivated: number; skipped: number; unrecognized_categories: string[] };
			}>(`/m1/stores/upload${qs}`, formData);
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
						- one sheet per category (sheet name = category label or key)
					</p>
					<p>
						<span className="font-mono text-xs bg-white border border-gray-200 rounded px-1">.csv</span>{' '}
						- single column <span className="font-mono text-xs">Store name</span>, select category below
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
								onChange={(e) => setCsvCategory(e.target.value)}
								className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
							>
								<option value="">Select category…</option>
								{categories.filter((c) => c.is_active).map((cat) => (
									<option key={cat.key} value={cat.key}>{cat.label}</option>
								))}
							</select>
							<p className="text-xs text-gray-400 mt-1">
								Skip if your CSV has a <span className="font-mono">Category</span> column.
							</p>
						</Field>
					)}

					{error && <p className="text-sm text-red-600">{error}</p>}

					{result && (
						<div className="space-y-2">
							<div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1 text-sm">
								<p className="font-semibold text-green-800">Upload complete</p>
								<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-green-700 mt-2">
									<span>Rows parsed</span><span className="font-mono font-semibold">{result.parsed}</span>
									<span>Inserted</span><span className="font-mono font-semibold">{result.inserted}</span>
									<span>Reactivated</span><span className="font-mono font-semibold">{result.reactivated}</span>
									<span>Skipped (already active)</span><span className="font-mono font-semibold">{result.skipped}</span>
								</div>
							</div>
							{result.unrecognized_categories.length > 0 && (
								<div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
									<p className="font-medium text-amber-800 mb-1">Unrecognized categories — rows skipped</p>
									<ul className="space-y-0.5">
										{result.unrecognized_categories.map((c) => (
											<li key={c} className="font-mono text-xs text-amber-700">{c}</li>
										))}
									</ul>
									<p className="text-xs text-amber-600 mt-2">
										Add these as categories first, then re-upload.
									</p>
								</div>
							)}
						</div>
					)}

					<div className="flex gap-3 pt-2">
						{!result ? (
							<>
								<button
									type="submit"
									disabled={uploading || !file}
									className="flex-1 bg-primary-600 text-white text-sm rounded-lg py-2 hover:bg-primary-700 disabled:opacity-50 transition-colors"
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
								className="flex-1 bg-primary-600 text-white text-sm rounded-lg py-2 hover:bg-primary-700 transition-colors"
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

function CategoriesPanel({
	categories,
	onClose,
	onSaved,
}: {
	categories: StoreCategoryRecord[];
	onClose: () => void;
	onSaved: () => Promise<void>;
}) {
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [showAdd, setShowAdd] = useState(false);

	return (
		<SlidePanel title="Manage categories" onClose={onClose}>
			<div className="space-y-5">
				<p className="text-sm text-gray-500">
					Categories group stores in the employee application form. A category key is permanent once set — only the label and settings can be changed.
				</p>

				<div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
					{categories.map((cat) =>
						editingKey === cat.key ? (
							<CategoryEditRow
								key={cat.key}
								cat={cat}
								onSaved={async () => { setEditingKey(null); await onSaved(); }}
								onCancel={() => setEditingKey(null)}
							/>
						) : (
							<CategoryRow
								key={cat.key}
								cat={cat}
								onEdit={() => { setEditingKey(cat.key); setShowAdd(false); }}
							/>
						)
					)}
					{categories.length === 0 && (
						<div className="px-4 py-6 text-center text-sm text-gray-400">No categories yet</div>
					)}
				</div>

				{showAdd ? (
					<AddCategoryForm
						onSaved={async () => { setShowAdd(false); await onSaved(); }}
						onCancel={() => setShowAdd(false)}
					/>
				) : (
					<button
						onClick={() => { setShowAdd(true); setEditingKey(null); }}
						className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
					>
						+ Add category
					</button>
				)}
			</div>
		</SlidePanel>
	);
}

function CategoryRow({
	cat,
	onEdit,
}: {
	cat: StoreCategoryRecord;
	onEdit: () => void;
}) {
	return (
		<div className="px-4 py-3 flex items-center gap-3">
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium truncate">{cat.label}</p>
				<p className="text-xs text-gray-400 font-mono mt-0.5">{cat.key}</p>
			</div>
			<div className="flex items-center gap-1.5 shrink-0">
				{cat.is_single_store && (
					<span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
						Single store
					</span>
				)}
				<span className={`text-xs rounded-full px-2 py-0.5 border ${
					cat.is_active
						? 'bg-green-50 text-green-700 border-green-200'
						: 'bg-gray-50 text-gray-500 border-gray-200'
				}`}>
					{cat.is_active ? 'Active' : 'Inactive'}
				</span>
				<button
					onClick={onEdit}
					className="text-xs text-gray-500 hover:text-gray-900 underline ml-1"
				>
					Edit
				</button>
			</div>
		</div>
	);
}

function CategoryEditRow({
	cat,
	onSaved,
	onCancel,
}: {
	cat: StoreCategoryRecord;
	onSaved: () => Promise<void>;
	onCancel: () => void;
}) {
	const [label, setLabel] = useState(cat.label);
	const [isSingleStore, setIsSingleStore] = useState(cat.is_single_store);
	const [displayOrder, setDisplayOrder] = useState(cat.display_order);
	const [isActive, setIsActive] = useState(cat.is_active);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError('');
		try {
			await api(`/m1/store-categories/${cat.key}`, {
				method: 'PATCH',
				body: { label: label.trim(), is_single_store: isSingleStore, display_order: displayOrder, is_active: isActive },
			});
			await onSaved();
		} catch (err: any) {
			setError(err.message ?? 'Failed to update category');
		} finally {
			setSaving(false);
		}
	}

	return (
		<form onSubmit={submit} className="px-4 py-3 bg-gray-50 space-y-3">
			<div className="flex items-center gap-2 text-xs text-gray-500">
				<span className="font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5">{cat.key}</span>
				<span className="text-gray-400">key is permanent</span>
			</div>

			<Field label="Label">
				<input
					type="text"
					required
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
				/>
			</Field>

			<Field label="Display order">
				<input
					type="number"
					value={displayOrder}
					min={1}
					onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
					className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
				/>
			</Field>

			<div className="flex gap-6">
				<label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
					<input
						type="checkbox"
						checked={isSingleStore}
						onChange={(e) => setIsSingleStore(e.target.checked)}
						className="rounded"
					/>
					Single store
				</label>
				<label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
					<input
						type="checkbox"
						checked={isActive}
						onChange={(e) => setIsActive(e.target.checked)}
						className="rounded"
					/>
					Active
				</label>
			</div>

			{error && <p className="text-sm text-red-600">{error}</p>}

			<div className="flex gap-2">
				<button
					type="submit"
					disabled={saving}
					className="flex-1 bg-primary-600 text-white text-sm rounded-lg py-1.5 hover:bg-primary-700 disabled:opacity-50 transition-colors"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="flex-1 border border-gray-300 text-sm rounded-lg py-1.5 hover:bg-gray-50 transition-colors"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

function AddCategoryForm({
	onSaved,
	onCancel,
}: {
	onSaved: () => Promise<void>;
	onCancel: () => void;
}) {
	const [key, setKey] = useState('');
	const [label, setLabel] = useState('');
	const [isSingleStore, setIsSingleStore] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError('');
		try {
			await api('/m1/store-categories', {
				method: 'POST',
				body: { key: key.trim(), label: label.trim(), is_single_store: isSingleStore },
			});
			await onSaved();
		} catch (err: any) {
			setError(err.message ?? 'Failed to create category');
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
			<p className="text-sm font-semibold text-gray-700">New category</p>
			<form onSubmit={submit} className="space-y-3">
				<Field label="Key (permanent identifier)">
					<input
						type="text"
						required
						value={key}
						onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
						className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono"
						placeholder="e.g. fuel_station"
					/>
					<p className="text-xs text-gray-400 mt-1">
						Lowercase letters, numbers, underscores only. Cannot be changed later.
					</p>
				</Field>

				<Field label="Label (shown to employees)">
					<input
						type="text"
						required
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
						placeholder="e.g. Fuel Station"
					/>
				</Field>

				<label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
					<input
						type="checkbox"
						checked={isSingleStore}
						onChange={(e) => setIsSingleStore(e.target.checked)}
						className="rounded"
					/>
					Single store (auto-selects when employee picks this category)
				</label>

				{error && <p className="text-sm text-red-600">{error}</p>}

				<div className="flex gap-2">
					<button
						type="submit"
						disabled={saving || !key || !label}
						className="flex-1 bg-primary-600 text-white text-sm rounded-lg py-1.5 hover:bg-primary-700 disabled:opacity-50 transition-colors"
					>
						{saving ? 'Creating…' : 'Create category'}
					</button>
					<button
						type="button"
						onClick={onCancel}
						className="flex-1 border border-gray-300 text-sm rounded-lg py-1.5 hover:bg-gray-50 transition-colors"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
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
