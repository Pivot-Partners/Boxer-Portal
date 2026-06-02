'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ConfigEntry {
	id: string;
	module: string;
	config_key: string;
	config_value: string;
	description: string | null;
	updated_at: string | null;
}

const CONFIG_STATUS: Record<string, { label: string; colour: string; note?: string }> = {
	admin_max_failed_logins: { label: 'Live', colour: 'bg-green-100 text-green-700' },
	batch_cutoff_day: { label: 'Needs cron job', colour: 'bg-amber-100 text-amber-700', note: 'Auto-close cron not yet built. Batches are closed manually.' },
	batch_cutoff_hour: { label: 'Needs cron job', colour: 'bg-amber-100 text-amber-700', note: 'Used alongside batch_cutoff_day when the auto-close job runs.' },
	otp_expiry_minutes: { label: 'Not yet built', colour: 'bg-gray-100 text-gray-500', note: 'OTP verification flow not yet implemented.' },
	otp_max_attempts: { label: 'Not yet built', colour: 'bg-gray-100 text-gray-500', note: 'OTP verification flow not yet implemented.' },
	employee_session_hours: { label: 'Not wired', colour: 'bg-gray-100 text-gray-500', note: 'Employee JWT expiry is currently hardcoded to 4 hours.' },
};

export default function ConfigPage() {
	const [entries, setEntries] = useState<ConfigEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [editValue, setEditValue] = useState('');
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState('');

	useEffect(() => {
		api<{ data: ConfigEntry[] }>('/admin/config')
			.then((r) => setEntries(r.data ?? []))
			.catch((err) => setError(err instanceof Error ? err.message : 'Failed to load config'))
			.finally(() => setLoading(false));
	}, []);

	function startEdit(entry: ConfigEntry) {
		setEditingKey(entry.config_key);
		setEditValue(entry.config_value);
		setSaveError('');
	}

	async function saveEdit(key: string) {
		setSaving(true);
		setSaveError('');
		try {
			const res = await api<{ data: ConfigEntry }>(`/admin/config/${key}`, {
				method: 'PATCH',
				body: { config_value: editValue },
			});
			setEntries((prev) => prev.map((e) => (e.config_key === key ? res.data : e)));
			setEditingKey(null);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : 'Save failed');
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return (
			<div className="space-y-6 animate-pulse">
				<div className="h-8 bg-gray-200 rounded w-48" />
				<div className="h-64 bg-gray-100 rounded-xl" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
				{error === 'Forbidden' || error.includes('403')
					? 'This page is restricted to super admins.'
					: error}
			</div>
		);
	}

	const grouped = entries.reduce<Record<string, ConfigEntry[]>>((acc, e) => {
		(acc[e.module] ??= []).push(e);
		return acc;
	}, {});

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold">System Config</h1>
				<p className="text-gray-500 text-sm mt-1">Operational settings — changes take effect immediately</p>
			</div>

			{Object.entries(grouped).map(([module, items]) => (
				<div key={module} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
					<div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
						<p className="text-xs font-bold uppercase tracking-wider text-gray-500">{module}</p>
					</div>
					<table className="w-full text-sm">
						<thead className="border-b border-gray-100">
							<tr>
								<th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 w-52">Key</th>
								<th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Value</th>
								<th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Description</th>
								<th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">Last updated</th>
								<th className="px-5 py-2.5 w-24" />
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{items.map((entry) => (
								<tr key={entry.config_key} className={editingKey === entry.config_key ? 'bg-blue-50' : 'hover:bg-gray-50'}>
									<td className="px-5 py-3 font-mono text-xs text-gray-700">{entry.config_key}</td>
									<td className="px-5 py-3">
										{editingKey === entry.config_key ? (
											<div className="space-y-1">
												<input
													type="text"
													value={editValue}
													onChange={(e) => setEditValue(e.target.value)}
													autoFocus
													className="w-full px-2.5 py-1.5 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
												/>
												{saveError && <p className="text-xs text-red-600">{saveError}</p>}
											</div>
										) : (
											<span className="font-semibold">{entry.config_value}</span>
										)}
									</td>
									<td className="px-5 py-3 hidden md:table-cell">
										<div className="space-y-1">
											<p className="text-xs text-gray-500">{entry.description ?? '—'}</p>
											{CONFIG_STATUS[entry.config_key] && (
												<div className="flex items-center gap-1.5">
													<span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${CONFIG_STATUS[entry.config_key]!.colour}`}>
														{CONFIG_STATUS[entry.config_key]!.label}
													</span>
													{CONFIG_STATUS[entry.config_key]!.note && (
														<span className="text-[10px] text-gray-400">{CONFIG_STATUS[entry.config_key]!.note}</span>
													)}
												</div>
											)}
										</div>
									</td>
									<td className="px-5 py-3 text-gray-400 text-xs hidden lg:table-cell">
										{entry.updated_at
											? new Date(entry.updated_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
											: '—'}
									</td>
									<td className="px-5 py-3 text-right">
										{editingKey === entry.config_key ? (
											<div className="flex items-center justify-end gap-2">
												<button
													onClick={() => saveEdit(entry.config_key)}
													disabled={saving || !editValue.trim()}
													className="text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-40"
												>
													{saving ? 'Saving…' : 'Save'}
												</button>
												<button
													onClick={() => setEditingKey(null)}
													disabled={saving}
													className="text-xs text-gray-500 hover:text-gray-700"
												>
													Cancel
												</button>
											</div>
										) : (
											<button
												onClick={() => startEdit(entry)}
												className="text-xs font-medium text-gray-500 hover:text-gray-800"
											>
												Edit
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			))}
		</div>
	);
}
