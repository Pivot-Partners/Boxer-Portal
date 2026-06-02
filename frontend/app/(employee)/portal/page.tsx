'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Batch {
	id: string;
	batch_month: string;
	cutoff_at: string;
	status: string;
	created_at: string;
}

interface Application {
	id: string;
	reference_number: string;
	status: string;
	place_of_work: string;
	contact_number: string;
	rental_term: number;
	submitted_at: string;
	phone_model_id: string;
	batch_phone_catalogue: {
		model_name: string;
		cash_price: number;
		upfront_amount: number;
		rental_amount_7m: number;
		rental_amount_13m: number;
	};
}

interface Me {
	display_name?: string;
	eligible_model_ids?: string[];
	salary_band?: string;
}

interface PhoneModel {
	id: string;
	model_name: string;
	cash_price: number;
	upfront_amount: number;
	rental_amount_7m: number;
	rental_amount_13m: number;
	display_order: number;
}

const BAND_FLOOR: Record<string, number> = {
	'>3600': 3600,
	'>4400': 4400,
	'>6596': 6596,
	'>8796': 8796,
	'>13595': 13595,
	'>17196': 17196,
};

const STATUS_LABEL: Record<string, { text: string; colour: string }> = {
	pending: { text: 'Submitted - awaiting batch', colour: 'bg-yellow-100 text-yellow-800' },
	validated: { text: 'Approved', colour: 'bg-green-100 text-green-800' },
	converted_to_order: { text: 'Order placed', colour: 'bg-blue-100 text-blue-800' },
	cancelled_by_employee: { text: 'Cancelled by you', colour: 'bg-gray-100 text-gray-600' },
	cancelled_by_admin: { text: 'Cancelled by admin', colour: 'bg-gray-100 text-gray-600' },
	cancelled_no_whitelist: { text: 'Cancelled - eligibility issue', colour: 'bg-red-100 text-red-700' },
	cancelled_no_stock: { text: 'Cancelled - out of stock', colour: 'bg-red-100 text-red-700' },
	rejected: { text: 'Rejected', colour: 'bg-red-100 text-red-700' },
};

function zar(n: number) {
	return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function rentalLabel(term: number, cat: Application['batch_phone_catalogue']) {
	if (term === 0) return `Cash - ${zar(cat.cash_price)} deducted once`;
	if (term === 7) return `7 months @ ${zar(cat.rental_amount_7m)}/month`;
	return `13 months @ ${zar(cat.rental_amount_13m)}/month`;
}

export default function PortalPage() {
	const [batch, setBatch] = useState<Batch | null>(null);
	const [application, setApplication] = useState<Application | null | undefined>(undefined);
	const [me, setMe] = useState<Me | null>(null);
	const [cancelling, setCancelling] = useState(false);
	const [cancelError, setCancelError] = useState('');
	const [loading, setLoading] = useState(true);

	const [editing, setEditing] = useState(false);
	const [editPhones, setEditPhones] = useState<PhoneModel[]>([]);
	const [editModelId, setEditModelId] = useState('');
	const [editTerm, setEditTerm] = useState<0 | 7 | 13 | null>(null);
	const [editLoading, setEditLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState('');

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
			setEditing(false);
		} catch (err) {
			setCancelError(err instanceof Error ? err.message : 'Could not cancel');
		} finally {
			setCancelling(false);
		}
	}

	async function startEditing() {
		setEditLoading(true);
		setSaveError('');
		try {
			const res = await api<{ data: PhoneModel[] }>('/m1/phone-models');
			const filtered = (res.data ?? []).filter((p) => me?.eligible_model_ids?.includes(p.id));
			setEditPhones(filtered);
			setEditModelId(application?.phone_model_id ?? '');
			setEditTerm((application?.rental_term ?? null) as 0 | 7 | 13 | null);
			setEditing(true);
		} catch {
			setSaveError('Failed to load phone models. Please try again.');
		} finally {
			setEditLoading(false);
		}
	}

	async function saveEdit() {
		if (!editModelId || editTerm === null) return;
		setSaving(true);
		setSaveError('');
		try {
			const res = await api<{ data: Application }>('/m1/applications/mine', {
				method: 'PATCH',
				body: { phone_model_id: editModelId, rental_term: editTerm },
			});
			setApplication(res.data);
			setEditing(false);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
		} finally {
			setSaving(false);
		}
	}

	const isOpen =
		batch?.status === 'open' &&
		!!batch.cutoff_at &&
		new Date() < new Date(batch.cutoff_at);

	const isEligible = (me?.eligible_model_ids?.length ?? 0) > 0;
	const hasActive = application && !['cancelled_by_employee', 'superseded'].includes(application.status);
	const bandFloor = me?.salary_band ? (BAND_FLOOR[me.salary_band] ?? 0) : 0;

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
			<div className={`rounded-xl p-4 border ${isOpen ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200'}`}>
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

			{!isEligible ? (
				<div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
					<p className="font-semibold text-amber-900">Not eligible for this scheme</p>
					<p className="text-sm text-amber-800 mt-1">
						Your current salary band does not qualify for the Boxer Staff Phone Rental Scheme.
						If you believe this is incorrect, please speak to your HR representative.
					</p>
				</div>
			) : hasActive && application ? (
				<div className="space-y-4">
					{/* Current application card */}
					<div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Your application</p>
								<p className="font-bold text-lg">{application.batch_phone_catalogue?.model_name}</p>
								<p className="text-sm text-gray-600">{application.place_of_work}</p>
								<p className="text-sm text-gray-500 mt-0.5">
									{rentalLabel(application.rental_term, application.batch_phone_catalogue)}
								</p>
							</div>
							<span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_LABEL[application.status]?.colour ?? 'bg-gray-100 text-gray-600'}`}>
								{STATUS_LABEL[application.status]?.text ?? application.status}
							</span>
						</div>

						<div className="border-t border-gray-100 pt-3 space-y-1">
							<p className="text-xs text-gray-400">
								Reference: <span className="font-mono">{application.reference_number}</span>
								{' · '}
								Submitted {new Date(application.submitted_at).toLocaleDateString('en-ZA')}
							</p>
							{batch && (
								<p className="text-xs text-gray-400">
									Batch open: {new Date(batch.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
									{' · '}
									Closes: {new Date(batch.cutoff_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
								</p>
							)}
						</div>

						{application.status === 'pending' && isOpen && !editing && (
							<div className="flex flex-wrap items-center gap-4 pt-1">
								<button
									onClick={startEditing}
									disabled={editLoading}
									className="text-sm font-medium text-primary-700 hover:text-primary-800 disabled:opacity-50"
								>
									{editLoading ? 'Loading…' : 'Edit selection →'}
								</button>
								<button
									onClick={cancelApplication}
									disabled={cancelling}
									className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
								>
									{cancelling ? 'Cancelling…' : 'Cancel application'}
								</button>
							</div>
						)}

						{cancelError && <p className="text-xs text-red-600">{cancelError}</p>}
					</div>

					{/* Inline edit picker */}
					{editing && (
						<div className="bg-white rounded-xl border border-primary-200 p-5 space-y-4">
							<div>
								<p className="font-semibold text-gray-900">Change your selection</p>
								<p className="text-xs text-gray-500 mt-0.5">
									Your original submission date is preserved - this only changes your phone and payment option.
								</p>
							</div>

							<div className="space-y-3">
								{editPhones.map((phone) => {
									const canCash = bandFloor >= phone.cash_price * 4;
									const options: { label: string; sublabel: string; term: 0 | 7 | 13 }[] = [
										...(canCash ? [{ label: 'Buy for cash', sublabel: `${zar(phone.cash_price)} deducted once from salary`, term: 0 as const }] : []),
										{ label: '7-month rental', sublabel: `First deduction ${zar(phone.upfront_amount)}, then ${zar(phone.rental_amount_7m)}/month × 6`, term: 7 as const },
										{ label: '13-month rental', sublabel: `First deduction ${zar(phone.upfront_amount)}, then ${zar(phone.rental_amount_13m)}/month × 12`, term: 13 as const },
									];

									return (
										<div
											key={phone.id}
											className={`border rounded-xl overflow-hidden transition-all ${editModelId === phone.id ? 'border-primary-500 shadow-sm' : 'border-gray-200'}`}
										>
											<div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
												<p className="font-semibold text-sm">{phone.model_name}</p>
											</div>
											<div className="divide-y divide-gray-100">
												{options.map(({ label, sublabel, term }) => {
													const selected = editModelId === phone.id && editTerm === term;
													return (
														<button
															key={term}
															type="button"
															onClick={() => { setEditModelId(phone.id); setEditTerm(term); }}
															className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${selected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
														>
															<div>
																<p className={`text-sm font-medium ${selected ? 'text-primary-800' : 'text-gray-700'}`}>{label}</p>
																<p className="text-xs text-gray-500">{sublabel}</p>
															</div>
															<div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-primary-700 bg-primary-700' : 'border-gray-300'}`}>
																{selected && <div className="w-2 h-2 rounded-full bg-white" />}
															</div>
														</button>
													);
												})}
											</div>
										</div>
									);
								})}
							</div>

							{saveError && (
								<div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
									{saveError}
								</div>
							)}

							<div className="flex items-center gap-4">
								<button
									onClick={saveEdit}
									disabled={saving || !editModelId || editTerm === null}
									className="flex-1 py-2.5 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
								>
									{saving ? 'Saving…' : 'Save changes'}
								</button>
								<button
									onClick={() => { setEditing(false); setSaveError(''); }}
									disabled={saving}
									className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
								>
									Discard
								</button>
							</div>
						</div>
					)}
				</div>
			) : isOpen && isEligible ? (
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
