'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface PhoneModel {
	id: string;
	model_name: string;
	model_code: string | null;
	retail_price: number;
	upfront_amount: number;
	rental_amount_7m: number;
	rental_amount_13m: number;
	min_salary_band: string;
	display_order: number;
	is_active: boolean;
}

function zar(n: number) {
	return `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

export default function PhonesPage() {
	const [models, setModels] = useState<PhoneModel[]>([]);
	const [loading, setLoading] = useState(true);
	const [toggling, setToggling] = useState<string | null>(null);
	const [editId, setEditId] = useState<string | null>(null);
	const [editData, setEditData] = useState<Partial<PhoneModel>>({});
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState('');

	async function fetchModels() {
		const res = await api<{ data: PhoneModel[] }>('/m1/phone-models/all');
		setModels(res.data ?? []);
	}

	useEffect(() => {
		fetchModels().finally(() => setLoading(false));
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
			retail_price: model.retail_price,
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

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="text-gray-400 text-sm">Loading…</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Phone Models</h1>
				<p className="text-gray-500 text-sm mt-1">Manage the available phone catalogue and pricing</p>
			</div>

			<div className="space-y-3">
				{models.map((model) => (
					<div
						key={model.id}
						className={`bg-white border rounded-xl p-4 transition-opacity ${
							model.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
						}`}
					>
						{editId === model.id ? (
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="font-semibold">{model.model_name}</h3>
									<span className="text-xs text-gray-500">Editing</span>
								</div>
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
									{(
										[
											{ key: 'retail_price', label: 'Retail price' },
											{ key: 'upfront_amount', label: 'Cash upfront' },
											{ key: 'rental_amount_7m', label: '7-month amount' },
											{ key: 'rental_amount_13m', label: '13-month amount' },
										] as const
									).map(({ key, label }) => (
										<div key={key}>
											<label className="block text-xs text-gray-500 mb-1">{label}</label>
											<input
												type="number"
												step="0.01"
												value={editData[key] ?? ''}
												onChange={(e) =>
													setEditData((d) => ({ ...d, [key]: parseFloat(e.target.value) }))
												}
												className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
											/>
										</div>
									))}
								</div>
								{saveError && <p className="text-xs text-red-600">{saveError}</p>}
								<div className="flex gap-3">
									<button
										onClick={saveEdit}
										disabled={saving}
										className="px-4 py-1.5 bg-primary-700 hover:bg-primary-800 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
									>
										{saving ? 'Saving…' : 'Save'}
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
									<div className="flex items-center gap-2">
										<h3 className="font-semibold text-sm">{model.model_name}</h3>
										{model.model_code && (
											<span className="text-xs text-gray-400 font-mono">{model.model_code}</span>
										)}
										{!model.is_active && (
											<span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactive</span>
										)}
									</div>
									<div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
										<span className="text-xs text-gray-500">Retail: {zar(model.retail_price)}</span>
										<span className="text-xs text-gray-500">Cash: {zar(model.upfront_amount)}</span>
										<span className="text-xs text-gray-500">7m: {zar(model.rental_amount_7m)}/mo</span>
										<span className="text-xs text-gray-500">13m: {zar(model.rental_amount_13m)}/mo</span>
										<span className="text-xs text-gray-400">Min band: {model.min_salary_band}</span>
									</div>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<button
										onClick={() => startEdit(model)}
										className="text-xs text-primary-700 hover:text-primary-800 font-medium"
									>
										Edit prices
									</button>
									<button
										onClick={() => toggleActive(model)}
										disabled={toggling === model.id}
										className={`text-xs font-medium disabled:opacity-50 transition-colors ${
											model.is_active
												? 'text-red-600 hover:text-red-700'
												: 'text-green-600 hover:text-green-700'
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
