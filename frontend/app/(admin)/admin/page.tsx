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
	open: 'bg-emerald-100 text-emerald-800',
	closed: 'bg-gray-100 text-gray-600',
	processing: 'bg-blue-100 text-blue-800',
	awaiting_approval: 'bg-amber-100 text-amber-800',
	approved: 'bg-emerald-100 text-emerald-800',
	orders_submitted: 'bg-blue-100 text-blue-800',
	completed: 'bg-gray-100 text-gray-600',
};

const QUICK_ACTIONS = [
	{
		href: '/admin/whitelist',
		title: 'Upload HR Whitelist',
		desc: 'Refresh the eligible employee list from HR CSV files',
		icon: (
			<svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
			</svg>
		),
	},
	{
		href: '/admin/batches',
		title: 'Manage Batches',
		desc: 'Open a new batch or approve the current batch for processing',
		icon: (
			<svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M2 17l10 5 10-5M2 12l10 5 10-5" />
			</svg>
		),
	},
	{
		href: '/admin/phones',
		title: 'Phone Catalogue',
		desc: 'Manage available phone models, pricing, and availability',
		icon: (
			<svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<rect x="5" y="2" width="14" height="20" rx="2" />
				<path strokeLinecap="round" d="M12 18h.01" />
			</svg>
		),
	},
	{
		href: '/admin/applications',
		title: 'View Applications',
		desc: 'Review, filter, and edit employee applications',
		icon: (
			<svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				<path strokeLinecap="round" d="M9 12h6M9 16h4" />
			</svg>
		),
	},
];

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

	const currentBatch = batches.find((b) => b.status === 'open') ?? batches[0];
	const latestUpload = uploads[0];
	const firstName = (me?.full_name ?? me?.display_name)?.split(' ')[0];

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="text-gray-400 text-sm">Loading…</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Page header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">
						{firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
					</h1>
					<p className="text-gray-500 text-sm mt-1 capitalize">
						{me?.role?.replace(/_/g, ' ')} - Module 1: Staff Phone Rental
					</p>
				</div>
				<div className="hidden sm:flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm shrink-0">
					<div className="w-2 h-2 rounded-full bg-emerald-400" />
					<span className="text-xs font-medium text-gray-600">System active</span>
				</div>
			</div>

			{/* Awaiting approval alert */}
			{currentBatch?.status === 'awaiting_approval' && (
				<div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
					<div className="flex items-start gap-3">
						<svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<div>
							<p className="font-semibold text-amber-900 text-sm">Batch awaiting your approval</p>
							<p className="text-amber-700 text-xs mt-0.5">
								The current batch has closed and is ready for review.
							</p>
						</div>
					</div>
					<Link
						href="/admin/batches"
						className="shrink-0 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors"
					>
						Review now
					</Link>
				</div>
			)}

			{/* Stats */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<StatCard
					label="Current Batch"
					value={
						currentBatch
							? new Date(currentBatch.batch_month).toLocaleDateString('en-ZA', {
								month: 'long',
								year: 'numeric',
								timeZone: 'UTC',
							})
							: 'No active batch'
					}
					sub={currentBatch ? <StatusBadge status={currentBatch.status} /> : undefined}
					href="/admin/batches"
				/>
				<StatCard
					label="Applications"
					value={currentBatch?.total_applications?.toString() ?? '-'}
					sub={
						currentBatch
							? `${currentBatch.valid_applications ?? 0} validated`
							: 'No active batch'
					}
					href="/admin/applications"
				/>
				<StatCard
					label="HR Whitelist"
					value={
						latestUpload
							? `${latestUpload.valid_count?.toLocaleString()} records`
							: 'Not loaded'
					}
					sub={
						latestUpload
							? new Date(latestUpload.uploaded_at).toLocaleDateString('en-ZA')
							: 'Upload a whitelist to enable eligibility checks'
					}
					href="/admin/whitelist"
				/>
			</div>

			{/* Quick actions */}
			<div>
				<h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
					Quick Actions
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{QUICK_ACTIONS.map(({ href, title, desc, icon }) => (
						<ActionCard key={href} href={href} title={title} desc={desc} icon={icon} />
					))}
				</div>
			</div>
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
			className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-gray-300 transition-all block group"
		>
			<p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
			<p className="text-2xl font-bold text-gray-900 mt-1.5 group-hover:text-slate-700 transition-colors">
				{value}
			</p>
			{sub && <div className="mt-2 text-sm text-gray-500">{sub}</div>}
		</Link>
	);
}

function ActionCard({
	href,
	title,
	desc,
	icon,
}: {
	href: string;
	title: string;
	desc: string;
	icon: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 hover:border-slate-300 hover:shadow-md transition-all block group"
		>
			<div className="flex items-start gap-3">
				<div className="shrink-0 w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center mt-0.5">
					{icon}
				</div>
				<div className="min-w-0">
					<p className="font-semibold text-sm text-gray-900">{title}</p>
					<p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
				</div>
				<svg
					className="w-4 h-4 text-gray-300 group-hover:text-slate-500 shrink-0 mt-1 transition-colors ml-auto"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</div>
		</Link>
	);
}

function StatusBadge({ status }: { status: string }) {
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
				BATCH_STATUS_COLOUR[status] ?? 'bg-gray-100 text-gray-600'
			}`}
		>
			{status.replace(/_/g, ' ')}
		</span>
	);
}
