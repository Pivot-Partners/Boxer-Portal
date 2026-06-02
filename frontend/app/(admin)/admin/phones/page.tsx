'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface PhoneModel {
	id: string;
	model_name: string;
	model_code: string | null;
	cash_price: number;
	upfront_amount: number;
	rental_amount_7m: number;
	rental_amount_13m: number;
	min_salary_band: string;
	display_order: number;
	is_active: boolean;
}

const SALARY_BANDS = ['>3600', '>4400', '>6596', '>8796', '>13595', '>17196'] as const;
const BAND_VALUES = [3600, 4400, 6596, 8796, 13595, 17196] as const;

function calcMinBand(amount: number): string {
	if (!amount || amount <= 0) return '—';
	const required = amount * 4;
	for (let i = 0; i < BAND_VALUES.length; i++) {
		if (BAND_VALUES[i]! >= required) return SALARY_BANDS[i]!;
	}
	return SALARY_BANDS[SALARY_BANDS.length - 1]!;
}

interface AddForm {
	model_name: string;
	model_code: string;
	cash_price: string;
	upfront_amount: string;
	rental_amount_7m: string;
	rental_amount_13m: string;
	display_order: string;
}

const EMPTY_ADD: AddForm = {
	model_name: '',
	model_code: '',
	cash_price: '',
	upfront_amount: '',
	rental_amount_7m: '',
	rental_amount_13m: '',
	display_order: '0',
};

function zar(n: number) {
	return `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

const fieldCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent';

export default function PhonesPage() {
	const [models, setModels] = useState<PhoneModel[]>([]);
	const [loading, setLoading] = useState(true);
	const [pageError, setPageError] = useState('');
	const [toggling, setToggling] = useState<string | null>(null);
	const [editId, setEditId] = useState<string | null>(null);
	const [editData, setEditData] = useState<Partial<PhoneModel>>({});
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState('');

	const [showAdd, setShowAdd] = useState(false);
	const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD);
	const [adding, setAdding] = useState(false);
	const [addError, setAddError] = useState('');

	async function fetchModels() {
		const res = await api<{ data: PhoneModel[] }>('/m1/phone-models/all');
		setModels(res.data ?? []);
	}

	useEffect(() => {
		fetchModels()
			.catch((err) => setPageError(err instanceof Error ? err.message : 'Failed to load phone models'))
			.finally(() => setLoading(false));
	}, []);

	async function toggleActive(model: PhoneModel) {
		setToggling(model.id);
		try {
			await api(`/m1/phone-models/${model.id}`, {
				method: 'PATCH',
				body: { is_active: !model.is_active },
			});
			await fetchModels();
		} catch {}
		setToggling(null);
	}

	function startEdit(model: PhoneModel) {
		setEditId(model.id);
		setEditData({
			cash_price: model.cash_price,
			upfront_amount: model.upfront_amount,
			rental_amount_7m: model.rental_amount_7m,
			rental_amount_13m: model.rental_amount_13m,
		});
		setSaveError('');
	}

	async function saveEdit() {
		if (!editId) return;
		setSaving(true);
		setSaveError('');
		try {
			await api(`/m1/phone-models/${editId}`, {
				method: 'PATCH',
				body: editData,
			});
			setEditId(null);
			await fetchModels();
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : 'Save failed');
		} finally {
			setSaving(false);
		}
	}

	async function submitAdd(e: React.FormEvent) {
		e.preventDefault();
		setAdding(true);
		setAddError('');
		try {
			await api('/m1/phone-models', {
				method: 'POST',
				body: {
					model_name: addForm.model_name.trim(),
					model_code: addForm.model_code.trim() || undefined,
					cash_price: parseFloat(addForm.cash_price),
					upfront_amount: parseFloat(addForm.upfront_amount),
					rental_amount_7m: parseFloat(addForm.rental_amount_7m),
					rental_amount_13m: parseFloat(addForm.rental_amount_13m),
					display_order: parseInt(addForm.display_order, 10) || 0,
				},
			});
			setAddForm(EMPTY_ADD);
			setShowAdd(false);
			await fetchModels();
		} catch (err) {
			setAddError(err instanceof Error ? err.message : 'Failed to create phone model');
		} finally {
			setAdding(false);
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="text-gray-400 text-sm">Loading…</div>
			</div>
		);
	}

	if (pageError) {
		return (
			<div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
				{pageError === 'Forbidden' || pageError.includes('403')
					? 'This page is restricted to M1 admins and super admins.'
					: pageError}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Phone Models</h1>
					<p className="text-gray-500 text-sm mt-1">Manage the available phone catalogue and pricing</p>
				</div>
				<button
					onClick={() => { setShowAdd((v) => !v); setAddError(''); }}
					className="shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors"
				>
					{showAdd ? 'Cancel' : '+ Add phone model'}
				</button>
			</div>

			{/* Add new phone form */}
			{showAdd && (
				<form
					onSubmit={submitAdd}
					className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4"
				>
					<h2 className="font-semibold text-gray-900">New phone model</h2>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-semibold text-gray-600 mb-1">
								Model name <span className="text-red-500">*</span>
							</label>
							<input
								type="text"
								required
								value={addForm.model_name}
								onChange={(e) => setAddForm((f) => ({ ...f, model_name: e.target.value }))}
								placeholder="e.g. Samsung Galaxy A15"
								className={fieldCls}
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold text-gray-600 mb-1">
								Model code <span className="text-gray-400 font-normal">(optional)</span>
							</label>
							<input
								type="text"
								value={addForm.model_code}
								onChange={(e) => setAddForm((f) => ({ ...f, model_code: e.target.value }))}
								placeholder="e.g. SM-A155F"
								className={`${fieldCls} font-mono`}
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						{(
							[
								{ key: 'cash_price' as const, label: 'Cash price' },
								{ key: 'upfront_amount' as const, label: 'Rental upfront' },
								{ key: 'rental_amount_7m' as const, label: '7-month amount' },
								{ key: 'rental_amount_13m' as const, label: '13-month amount' },
							]
						).map(({ key, label }) => (
							<div key={key}>
								<label className="block text-xs font-semibold text-gray-600 mb-1">
									{label} <span className="text-red-500">*</span>
								</label>
								<div className="relative">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">R</span>
									<input
										type="number"
										step="0.01"
										min="0.01"
										required
										value={addForm[key]}
										onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
										className={`${fieldCls} pl-7`}
									/>
								</div>
							</div>
						))}
					</div>

					{(addForm.upfront_amount || addForm.cash_price) && (
						<div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-800 flex gap-6">
							<span><span className="font-semibold">Rental min salary:</span> {zar((parseFloat(addForm.upfront_amount) || 0) * 4)}/mo</span>
							<span><span className="font-semibold">Cash min salary:</span> {zar((parseFloat(addForm.cash_price) || 0) * 4)}/mo</span>
						</div>
					)}

					<div className="w-32">
						<label className="block text-xs font-semibold text-gray-600 mb-1">Display order</label>
						<input
							type="number"
							min="0"
							value={addForm.display_order}
							onChange={(e) => setAddForm((f) => ({ ...f, display_order: e.target.value }))}
							className={fieldCls}
						/>
					</div>

					{addError && (
						<p className="text-sm text-red-600">{addError}</p>
					)}

					<div className="flex gap-3 pt-1">
						<button
							type="submit"
							disabled={adding}
							className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
						>
							{adding ? 'Adding…' : 'Add phone model'}
						</button>
						<button
							type="button"
							onClick={() => { setShowAdd(false); setAddForm(EMPTY_ADD); setAddError(''); }}
							className="px-5 py-2 border border-gray-300 text-gray-600 hover:text-gray-900 text-sm rounded-lg hover:bg-gray-50 transition-colors"
						>
							Cancel
						</button>
					</div>
				</form>
			)}

			{/* Phone model list */}
			<div className="space-y-3">
				{models.length === 0 && (
					<div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
						No phone models yet. Click <strong className="text-gray-600">+ Add phone model</strong> to add the first one.
					</div>
				)}

				{models.map((model) => (
					<div
						key={model.id}
						className={`bg-white border rounded-xl p-4 shadow-sm transition-opacity ${
							model.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
						}`}
					>
						{editId === model.id ? (
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="font-semibold text-gray-900">{model.model_name}</h3>
									<span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded">Editing prices</span>
								</div>
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
									{(
										[
											{ key: 'cash_price', label: 'Cash price' },
											{ key: 'upfront_amount', label: 'Rental upfront' },
											{ key: 'rental_amount_7m', label: '7-month amount' },
											{ key: 'rental_amount_13m', label: '13-month amount' },
										] as const
									).map(({ key, label }) => (
										<div key={key}>
											<label className="block text-xs text-gray-500 mb-1">{label}</label>
											<div className="relative">
												<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">R</span>
												<input
													type="number"
													step="0.01"
													value={editData[key] ?? ''}
													onChange={(e) =>
														setEditData((d) => ({ ...d, [key]: parseFloat(e.target.value) }))
													}
													className={`${fieldCls} pl-7`}
												/>
											</div>
										</div>
									))}
								</div>
								{saveError && <p className="text-xs text-red-600">{saveError}</p>}
								<div className="flex gap-3">
									<button
										onClick={saveEdit}
										disabled={saving}
										className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-sm rounded-lg disabled:opacity-50 transition-colors font-semibold"
									>
										{saving ? 'Saving…' : 'Save prices'}
									</button>
									<button
										onClick={() => setEditId(null)}
										className="px-4 py-1.5 text-gray-600 hover:text-gray-800 text-sm transition-colors"
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<div className="flex items-center gap-4">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<h3 className="font-semibold text-sm text-gray-900">{model.model_name}</h3>
										{model.model_code && (
											<span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
												{model.model_code}
											</span>
										)}
										{!model.is_active && (
											<span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
												Inactive
											</span>
										)}
									</div>
									<div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
										<span className="text-xs text-gray-500">Cash: <span className="font-medium text-gray-700">{zar(model.cash_price)}</span></span>
										<span className="text-xs text-gray-500">Upfront: <span className="font-medium text-gray-700">{zar(model.upfront_amount)}</span></span>
										<span className="text-xs text-gray-500">7m: <span className="font-medium text-gray-700">{zar(model.rental_amount_7m)}/mo</span></span>
										<span className="text-xs text-gray-500">13m: <span className="font-medium text-gray-700">{zar(model.rental_amount_13m)}/mo</span></span>
										<span className="text-xs text-gray-400">Order: {model.display_order}</span>
											<span className="text-xs text-gray-400">Rental min: <span className="font-medium text-gray-600">{zar(model.upfront_amount * 4)}/mo</span></span>
										<span className="text-xs text-gray-400">Cash min: <span className="font-medium text-gray-600">{zar(model.cash_price * 4)}/mo</span></span>
									</div>
								</div>
								<div className="flex items-center gap-3 shrink-0">
									<button
										onClick={() => startEdit(model)}
										className="text-xs text-slate-700 hover:text-slate-800 font-semibold"
									>
										Edit prices
									</button>
									<span className="text-gray-200">|</span>
									<button
										onClick={() => toggleActive(model)}
										disabled={toggling === model.id}
										className={`text-xs font-semibold disabled:opacity-50 transition-colors ${
											model.is_active
												? 'text-gray-400 hover:text-red-600'
												: 'text-gray-400 hover:text-emerald-600'
										}`}
									>
										{toggling === model.id ? '…' : model.is_active ? 'Deactivate' : 'Activate'}
									</button>
								</div>
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
