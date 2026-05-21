'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Batch {
	id: string;
	batch_month: string;
	cutoff_at: string;
	status: string;
}

interface Application {
	id: string;
	reference_number: string;
	status: string;
	place_of_work: string;
	contact_number: string;
	rental_term: number;
	submitted_at: string;
	phone_models: { model_name: string; rental_amount_7m: number; rental_amount_13m: number; upfront_amount: number };
}

interface Me {
	display_name?: string;
}

const STATUS_LABEL: Record<string, { text: string; colour: string }> = {
	pending: { text: 'Submitted — awaiting batch', colour: 'bg-yellow-100 text-yellow-800' },
	validated: { text: 'Approved', colour: 'bg-green-100 text-green-800' },
	converted_to_order: { text: 'Order placed', colour: 'bg-blue-100 text-blue-800' },
	cancelled_by_employee: { text: 'Cancelled by you', colour: 'bg-gray-100 text-gray-600' },
	cancelled_no_whitelist: { text: 'Cancelled — eligibility issue', colour: 'bg-red-100 text-red-700' },
	cancelled_no_stock: { text: 'Cancelled — out of stock', colour: 'bg-red-100 text-red-700' },
	rejected: { text: 'Rejected', colour: 'bg-red-100 text-red-700' },
};

function zar(n: number) {
	return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function rentalLabel(term: number, app: Application['phone_models']) {
	if (term === 0) return `Cash — ${zar(app.upfront_amount)} upfront`;
	if (term === 7) return `7 months @ ${zar(app.rental_amount_7m)}/month`;
	return `13 months @ ${zar(app.rental_amount_13m)}/month`;
}

export default function PortalPage() {
	const [batch, setBatch] = useState<Batch | null>(null);
	const [application, setApplication] = useState<Application | null | undefined>(undefined);
	const [me, setMe] = useState<Me | null>(null);
	const [cancelling, setCancelling] = useState(false);
	const [cancelError, setCancelError] = useState('');
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		Promise.all([
			api<{ data: Batch | null }>('/m1/batches/current').then((r) => setBatch(r.data)).catch(() => {}),
			api<{ data: Application | null }>('/m1/applications/mine').then((r) => setApplication(r.data)).catch(() => setApplication(null)),
			api<{ data: Me }>('/auth/me').then((r) => setMe(r.data)).catch(() => {}),
		]).finally(() => setLoading(false));
	}, []);

	async function cancelApplication() {
		setCancelling(true);
		setCancelError('');
		try {
			await api('/m1/applications/mine', { method: 'DELETE' });
			setApplication(null);
		} catch (err) {
			setCancelError(err instanceof Error ? err.message : 'Could not cancel');
		} finally {
			setCancelling(false);
		}
	}

	const isOpen =
		batch?.status === 'open' &&
		!!batch.cutoff_at &&
		new Date() < new Date(batch.cutoff_at);

	const hasActive = application && !['cancelled_by_employee', 'superseded'].includes(application.status);

	const cutoffDate = batch?.cutoff_at
		? new Date(batch.cutoff_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
		: '';

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="text-gray-400 text-sm">Loading…</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{me?.display_name && (
				<div>
					<h1 className="text-2xl font-bold">Hi, {me.display_name.split(' ')[0]}</h1>
					<p className="text-gray-500 text-sm mt-0.5">Boxer Staff Phone Rental Scheme</p>
				</div>
			)}

			{/* Batch status banner */}
			<div
				className={`rounded-xl p-4 border ${
					isOpen ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200'
				}`}
			>
				{isOpen ? (
					<>
						<p className="font-semibold text-green-800">Applications are open</p>
						<p className="text-sm text-green-700 mt-0.5">Deadline: {cutoffDate}</p>
					</>
				) : (
					<p className="text-gray-600 text-sm">
						Applications are currently closed. Check back at the start of next month.
					</p>
				)}
			</div>

			{/* Current application */}
			{hasActive && application ? (
				<div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Your application</p>
							<p className="font-bold text-lg">{application.phone_models?.model_name}</p>
							<p className="text-sm text-gray-600">{application.place_of_work}</p>
							<p className="text-sm text-gray-500 mt-0.5">
								{rentalLabel(application.rental_term, application.phone_models)}
							</p>
						</div>
						<span
							className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
								STATUS_LABEL[application.status]?.colour ?? 'bg-gray-100 text-gray-600'
							}`}
						>
							{STATUS_LABEL[application.status]?.text ?? application.status}
						</span>
					</div>

					<p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
						Reference: <span className="font-mono">{application.reference_number}</span>
						{' · '}
						Submitted {new Date(application.submitted_at).toLocaleDateString('en-ZA')}
					</p>

					{application.status === 'pending' && isOpen && (
						<div className="flex flex-wrap gap-4 pt-1">
							<Link
								href="/portal/apply"
								className="text-sm font-medium text-primary-700 hover:text-primary-800"
							>
								Change selection →
							</Link>
							<button
								onClick={cancelApplication}
								disabled={cancelling}
								className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
							>
								{cancelling ? 'Cancelling…' : 'Cancel application'}
							</button>
						</div>
					)}

					{cancelError && (
						<p className="text-xs text-red-600 mt-1">{cancelError}</p>
					)}
				</div>
			) : isOpen ? (
				<Link
					href="/portal/apply"
					className="block w-full text-center bg-primary-700 hover:bg-primary-800 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors"
				>
					Apply Now →
				</Link>
			) : application && !hasActive ? (
				<div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-500">
					Your previous application was{' '}
					{STATUS_LABEL[application.status]?.text?.toLowerCase() ?? application.status}.
				</div>
			) : null}
		</div>
	);
}
