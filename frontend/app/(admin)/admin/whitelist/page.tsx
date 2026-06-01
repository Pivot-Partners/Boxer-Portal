'use client';

import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '@/lib/api';

interface Upload {
	id: string;
	file_name: string;
	uploaded_at: string;
	record_count: number;
	valid_count: number;
	error_count: number;
	status: string;
}

const STATUS_COLOUR: Record<string, string> = {
	active: 'bg-green-100 text-green-700',
	processing: 'bg-yellow-100 text-yellow-700',
	failed: 'bg-red-100 text-red-700',
	superseded: 'bg-gray-100 text-gray-500',
};

export default function WhitelistPage() {
	const [uploads, setUploads] = useState<Upload[]>([]);
	const [loading, setLoading] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState('');
	const [uploadSuccess, setUploadSuccess] = useState('');
	const fileRef = useRef<HTMLInputElement>(null);

	async function fetchUploads() {
		try {
			const res = await api<{ data: Upload[] }>('/m1/whitelist/uploads');
			setUploads(res.data ?? []);
		} catch {}
	}

	useEffect(() => {
		fetchUploads().finally(() => setLoading(false));
	}, []);

	async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(e.target.files ?? []);
		if (files.length === 0) return;

		setUploadError('');
		setUploadSuccess('');
		setUploading(true);

		const formData = new FormData();
		for (const file of files) {
			formData.append('file', file);
		}

		try {
			const res = await apiUpload<{ data: { valid_count: number; error_count: number; record_count: number; files: number } }>(
				'/m1/whitelist/upload',
				formData
			);
			const fileLabel = (res.data?.files ?? 1) > 1 ? `${res.data?.files} files` : '1 file';
			setUploadSuccess(
				`Upload complete (${fileLabel}) - ${res.data?.valid_count?.toLocaleString()} valid records (${res.data?.error_count ?? 0} errors).`
			);
			await fetchUploads();
		} catch (err) {
			setUploadError(err instanceof Error ? err.message : 'Upload failed');
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = '';
		}
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold">HR Whitelist</h1>
				<p className="text-gray-500 text-sm mt-1">Upload both HR CSV files together to update the eligible employee list</p>
			</div>

			{/* Upload area */}
			<div className="bg-white border border-gray-200 rounded-xl p-6">
				<h2 className="font-semibold mb-4">Upload new whitelist</h2>

				<label
					className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
						uploading ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-300 hover:border-slate-400 hover:bg-slate-50'
					}`}
				>
					<input
						ref={fileRef}
						type="file"
						accept=".csv"
						multiple
						className="hidden"
						onChange={handleFileUpload}
						disabled={uploading}
					/>
					<div className="text-3xl mb-3">{uploading ? '⏳' : '📄'}</div>
					<p className="text-sm font-medium text-gray-700">
						{uploading ? 'Uploading and processing…' : 'Click to select HR CSV files'}
					</p>
					<p className="text-xs text-gray-500 mt-1">
						{uploading ? 'This may take a moment for large files' : 'Select both files at once (flexi + permanent)'}
					</p>
				</label>

				{uploadSuccess && (
					<div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
						{uploadSuccess}
					</div>
				)}
				{uploadError && (
					<div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
						{uploadError}
					</div>
				)}

				<div className="mt-4 text-xs text-gray-500 space-y-0.5">
					<p>Upload both files together: flexi workers (~4,000 records) and permanent workers (~14,400 records).</p>
					<p className="mt-1">Expected columns: EmployeeNo, Identity Number, First names, Last name, Store Number (or Store Num), Category, Pers. subarea text, salary band flags (&gt;3600 … &gt;17196)</p>
				</div>
			</div>

			{/* Upload history */}
			<div>
				<h2 className="font-semibold mb-3">Upload history</h2>
				{loading ? (
					<div className="text-gray-400 text-sm">Loading…</div>
				) : uploads.length === 0 ? (
					<div className="text-gray-500 text-sm">No uploads yet.</div>
				) : (
					<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
						<table className="w-full text-sm">
							<thead className="bg-gray-50 border-b border-gray-200">
								<tr>
									<th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">File</th>
									<th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Date</th>
									<th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Records</th>
									<th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Valid</th>
									<th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Errors</th>
									<th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{uploads.map((u) => (
									<tr key={u.id}>
										<td className="px-4 py-3 text-gray-700 max-w-xs truncate">{u.file_name}</td>
										<td className="px-4 py-3 text-gray-500 whitespace-nowrap">
											{new Date(u.uploaded_at).toLocaleDateString('en-ZA', {
												day: 'numeric', month: 'short', year: 'numeric',
											})}
										</td>
										<td className="px-4 py-3 text-right">{u.record_count?.toLocaleString() ?? '-'}</td>
										<td className="px-4 py-3 text-right text-green-700">{u.valid_count?.toLocaleString() ?? '-'}</td>
										<td className="px-4 py-3 text-right text-red-600">{u.error_count || '-'}</td>
										<td className="px-4 py-3">
											<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOUR[u.status] ?? 'bg-gray-100 text-gray-500'}`}>
												{u.status}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
