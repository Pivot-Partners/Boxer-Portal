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

// Batch lifecycle stages shown in the pipeline stepper
const STAGES = [
	{ key: 'open', label: 'Open' },
	{ key: 'closed', label: 'Closed' },
	{ key: 'awaiting_approval', label: 'Review' },
	{ key: 'approved', label: 'Approved' },
	{ key: 'completed', label: 'Complete' },
] as const;

const STATUS_TO_STEP: Record<string, number> = {
	open: 0,
	closed: 1,
	processing: 1,
	awaiting_approval: 2,
	approved: 3,
	orders_submitted: 3,
	completed: 4,
};

function formatCountdown(s: number): string {
	if (s <= 0) return 'Cutoff passed';
	const days = Math.floor(s / 86400);
	const hours = Math.floor((s % 86400) / 3600);
	const mins = Math.floor((s % 3600) / 60);
	const secs = s % 60;
	if (days > 0) return `${days}d ${hours}h ${String(mins).padStart(2, '0')}m`;
	if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
	return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function urgencyColour(s: number): string {
	if (s > 3 * 86400) return 'text-emerald-600';
	if (s > 86400) return 'text-amber-500';
	return 'text-red-600';
}

export default function AdminDashboard() {
	const [me, setMe] = useState<Me | null>(null);
	const [batches, setBatches] = useState<Batch[]>([]);
	const [uploads, setUploads] = useState<WhitelistUpload[]>([]);
	const [loading, setLoading] = useState(true);
	const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

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

	// Live countdown — ticks every second while batch is open
	useEffect(() => {
		if (!currentBatch || currentBatch.status !== 'open') {
			setSecondsLeft(null);
			return;
		}
		const cutoff = new Date(currentBatch.cutoff_at).getTime();
		const calc = () => setSecondsLeft(Math.max(0, Math.floor((cutoff - Date.now()) / 1000)));
		calc();
		const id = setInterval(calc, 1000);
		return () => clearInterval(id);
	}, [currentBatch?.id, currentBatch?.status, currentBatch?.cutoff_at]);

	const stepIdx = currentBatch ? (STATUS_TO_STEP[currentBatch.status] ?? 0) : -1;
	const totalEligible = latestUpload?.valid_count ?? 0;
	const totalApps = currentBatch?.total_applications ?? 0;
	const uptakePct = totalEligible > 0 ? Math.min(100, Math.round((totalApps / totalEligible) * 100)) : null;

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
						{me?.role?.replace(/_/g, ' ')} — Module 1: Staff Phone Rental
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
							<p className="text-amber-700 text-xs mt-0.5">The current batch has closed and is ready for review.</p>
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

			{/* Stat cards */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<StatCard
					label="Current Batch"
					value={
						currentBatch
							? new Date(currentBatch.batch_month).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
							: 'No active batch'
					}
					sub={currentBatch ? <StatusBadge status={currentBatch.status} /> : undefined}
					href="/admin/batches"
				/>
				<StatCard
					label="Applications"
					value={currentBatch ? totalApps.toLocaleString() : '—'}
					sub={currentBatch ? `${currentBatch.valid_applications ?? 0} validated` : 'No active batch'}
					href="/admin/applications"
				/>
				<StatCard
					label="Employee Uptake"
					value={uptakePct !== null ? `${uptakePct}%` : '—'}
					sub={
						uptakePct !== null ? (
							<div className="mt-1 space-y-1">
								<div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
									<div
										className="h-full bg-slate-700 rounded-full transition-all"
										style={{ width: `${uptakePct}%` }}
									/>
								</div>
								<p className="text-xs text-gray-400">{totalApps.toLocaleString()} of {totalEligible.toLocaleString()} eligible</p>
							</div>
						) : (
							'Upload a whitelist to track uptake'
						)
					}
					href="/admin/applications"
				/>
				<StatCard
					label="HR Whitelist"
					value={latestUpload ? latestUpload.valid_count.toLocaleString() : 'Not loaded'}
					sub={
						latestUpload
							? new Date(latestUpload.uploaded_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
							: 'Upload a whitelist to enable eligibility checks'
					}
					href="/admin/whitelist"
				/>
			</div>

			{/* Batch pipeline */}
			{currentBatch && (
				<div className="bg-white border border-gray-200 rounded-xl p-5">
					<div className="flex items-start justify-between gap-4 mb-6">
						<div>
							<h2 className="font-semibold text-sm text-gray-900">Batch Pipeline</h2>
							<p className="text-xs text-gray-400 mt-0.5">
								{new Date(currentBatch.batch_month).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
							</p>
						</div>
						{secondsLeft !== null && (
							<div className="text-right shrink-0">
								<p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Closes in</p>
								<p className={`text-xl font-bold tabular-nums leading-tight mt-0.5 ${urgencyColour(secondsLeft)}`}>
									{formatCountdown(secondsLeft)}
								</p>
								<p className="text-[10px] text-gray-400 mt-0.5">
									{new Date(currentBatch.cutoff_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
								</p>
							</div>
						)}
					</div>

					{/* Stepper */}
					<div className="flex items-start">
						{STAGES.map(({ label }, i) => {
							const isComplete = i < stepIdx;
							const isActive = i === stepIdx;
							return (
								<div key={label} className="flex items-start flex-1 last:flex-none">
									<div className="flex flex-col items-center gap-2 shrink-0">
										<div
											className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
												isComplete
													? 'bg-slate-700 text-white'
													: isActive
													? 'bg-slate-900 text-white ring-4 ring-slate-100'
													: 'bg-gray-100 text-gray-400'
											}`}
										>
											{isComplete ? (
												<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
												</svg>
											) : (
												i + 1
											)}
										</div>
										<p
											className={`text-[10px] font-semibold text-center leading-tight ${
												isActive ? 'text-slate-900' : isComplete ? 'text-gray-500' : 'text-gray-300'
											}`}
										>
											{label}
										</p>
									</div>
									{/* Connector */}
									{i < STAGES.length - 1 && (
										<div
											className={`flex-1 h-0.5 mt-4 mx-1.5 transition-colors ${
												i < stepIdx ? 'bg-slate-700' : 'bg-gray-200'
											}`}
										/>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Quick actions */}
			<div>
				<h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h2>
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
