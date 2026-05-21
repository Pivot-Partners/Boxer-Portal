'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Batch {
	id: string;
	batch_month: string;
	cutoff_at: string;
	status: string;
	total_applications: number;
	valid_applications: number;
}

interface WhitelistUpload {
	id: string;
	file_name: string;
	uploaded_at: string;
	record_count: number;
	valid_count: number;
	status: string;
}

interface Me {
	full_name?: string;
	display_name?: string;
	role: string;
}

const BATCH_STATUS_COLOUR: Record<string, string> = {
	open: 'bg-green-100 text-green-800',
	closed: 'bg-gray-100 text-gray-600',
	processing: 'bg-blue-100 text-blue-800',
	awaiting_approval: 'bg-yellow-100 text-yellow-800',
	approved: 'bg-green-100 text-green-800',
	orders_submitted: 'bg-blue-100 text-blue-800',
	completed: 'bg-gray-100 text-gray-600',
};

export default function AdminDashboard() {
	const [me, setMe] = useState<Me | null>(null);
	const [batches, setBatches] = useState<Batch[]>([]);
	const [uploads, setUploads] = useState<WhitelistUpload[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		Promise.all([
			api<{ data: Me }>('/auth/me').then((r) => setMe(r.data)).catch(() => {}),
			api<{ data: Batch[] }>('/m1/batches').then((r) => setBatches(r.data ?? [])).catch(() => {}),
			api<{ data: WhitelistUpload[] }>('/m1/whitelist/uploads').then((r) => setUploads(r.data ?? [])).catch(() => {}),
		]).finally(() => setLoading(false));
	}, []);

	const currentBatch = batches[0];
	const latestUpload = uploads[0];

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="text-gray-400 text-sm">Loading…</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold">
					Welcome{me?.full_name ?? me?.display_name ? `, ${(me?.full_name ?? me?.display_name)?.split(' ')[0]}` : ''}
				</h1>
				<p className="text-gray-500 text-sm mt-1 capitalize">{me?.role?.replace(/_/g, ' ')}</p>
			</div>

			{/* Quick stats */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<StatCard
					label="Current batch"
					value={
						currentBatch
							? new Date(currentBatch.batch_month + '-01').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
							: 'No active batch'
					}
					sub={currentBatch ? <StatusBadge status={currentBatch.status} /> : undefined}
					href="/admin/batches"
				/>
				<StatCard
					label="Applications"
					value={currentBatch?.total_applications?.toString() ?? '—'}
					sub={currentBatch ? `${currentBatch.valid_applications ?? 0} validated` : undefined}
					href="/admin/batches"
				/>
				<StatCard
					label="Whitelist"
					value={latestUpload ? `${latestUpload.valid_count?.toLocaleString()} records` : 'Not loaded'}
					sub={
						latestUpload
							? new Date(latestUpload.uploaded_at).toLocaleDateString('en-ZA')
							: undefined
					}
					href="/admin/whitelist"
				/>
			</div>

			{/* Quick actions */}
			<div>
				<h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick actions</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<ActionCard
						href="/admin/whitelist"
						title="Upload whitelist"
						desc="Upload HR CSV to update the eligible employee list"
					/>
					<ActionCard
						href="/admin/batches"
						title="Manage batches"
						desc="Open a new batch or approve the current batch for processing"
					/>
					<ActionCard
						href="/admin/phones"
						title="Phone catalogue"
						desc="View and manage available phone models and pricing"
					/>
				</div>
			</div>

			{/* Recent activity */}
			{currentBatch?.status === 'awaiting_approval' && (
				<div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between gap-4">
					<div>
						<p className="font-semibold text-yellow-800 text-sm">Batch awaiting approval</p>
						<p className="text-yellow-700 text-xs mt-0.5">
							The batch has closed and is ready for review and approval.
						</p>
					</div>
					<Link
						href="/admin/batches"
						className="shrink-0 text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
					>
						Review →
					</Link>
				</div>
			)}
		</div>
	);
}

function StatCard({
	label,
	value,
	sub,
	href,
}: {
	label: string;
	value: string;
	sub?: React.ReactNode;
	href: string;
}) {
	return (
		<Link
			href={href}
			className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors block"
		>
			<p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
			<p className="text-xl font-bold mt-1">{value}</p>
			{sub && <div className="mt-1 text-sm text-gray-500">{sub}</div>}
		</Link>
	);
}

function ActionCard({ href, title, desc }: { href: string; title: string; desc: string }) {
	return (
		<Link
			href={href}
			className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors block"
		>
			<p className="font-semibold text-sm">{title}</p>
			<p className="text-gray-500 text-xs mt-1">{desc}</p>
		</Link>
	);
}

function StatusBadge({ status }: { status: string }) {
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
				BATCH_STATUS_COLOUR[status] ?? 'bg-gray-100 text-gray-600'
			}`}
		>
			{status.replace(/_/g, ' ')}
		</span>
	);
}
