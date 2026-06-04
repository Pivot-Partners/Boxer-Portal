'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSalaryThreshold } from '@/lib/useSalaryThreshold';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoryRecord {
	key: string;
	label: string;
	is_single_store: boolean;
	is_active: boolean;
	display_order: number;
}

interface Store { id: string; name: string; category: string; }
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
interface Me {
	display_name?: string;
	eligible_model_ids: string[];
	salary_band?: string;
}

interface FormState {
	contactNumber: string;
	email: string;
	employeeNumber: string;
	idNumber: string;
	storeCategory: string;
	storeId: string;
	phoneModelId: string;
	rentalTerm: 0 | 7 | 13 | null;
	termsAccepted: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function zar(n: number) {
	return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function inputCls(invalid?: boolean) {
	return `w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
		invalid ? 'border-red-400 bg-red-50' : 'border-gray-300'
	}`;
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
	return (
		<div className="flex items-center gap-1 mb-8">
			{Array.from({ length: total }).map((_, i) => (
				<div
					key={i}
					className={`h-1 flex-1 rounded-full transition-colors ${
						i < current ? 'bg-primary-700' : i === current ? 'bg-primary-300' : 'bg-gray-200'
					}`}
				/>
			))}
		</div>
	);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApplyPage() {
	const { multiplier } = useSalaryThreshold();
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [me, setMe] = useState<Me | null>(null);
	const [stores, setStores] = useState<Record<string, Store[]>>({});
	const [categories, setCategories] = useState<CategoryRecord[]>([]);
	const [phones, setPhones] = useState<PhoneModel[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState('');
	const [successRef, setSuccessRef] = useState('');
	const submitGuard = useRef(false);

	const [form, setForm] = useState<FormState>({
		contactNumber: '',
		email: '',
		employeeNumber: '',
		idNumber: '',
		storeCategory: '',
		storeId: '',
		phoneModelId: '',
		rentalTerm: null,
		termsAccepted: false,
	});

	useEffect(() => {
		// Restore credentials from sessionStorage (set at login, cleared when tab closes)
		const storedEmpNo = sessionStorage.getItem('boxer_emp_no') ?? '';
		const storedIdNo = sessionStorage.getItem('boxer_id_no') ?? '';
		if (storedEmpNo || storedIdNo) {
			setForm((f) => ({ ...f, employeeNumber: storedEmpNo, idNumber: storedIdNo }));
		}

		Promise.all([
			api<{ data: Me }>('/auth/me').then((r) => setMe(r.data)),
			api<{ data: Record<string, Store[]> }>('/m1/stores').then((r) => setStores(r.data ?? {})),
			api<{ data: PhoneModel[] }>('/m1/phone-models').then((r) => setPhones(r.data ?? [])),
			api<{ data: CategoryRecord[] }>('/m1/store-categories').then((r) => setCategories(r.data ?? [])),
		])
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	function patch(updates: Partial<FormState>) {
		setForm((f) => ({ ...f, ...updates }));
	}

	// Derived from fetched categories
	const singleStoreKeys = new Set(categories.filter((c) => c.is_single_store).map((c) => c.key));
	const availableCategories = categories.filter(
		(c) => c.is_active && (stores[c.key]?.length ?? 0) > 0,
	);
	function categoryLabel(key: string): string {
		return categories.find((c) => c.key === key)?.label ?? key;
	}

	// Auto-select store for single-store categories
	function handleCategoryChange(cat: string) {
		const categoryStores = stores[cat] ?? [];
		if (singleStoreKeys.has(cat) && categoryStores.length === 1) {
			patch({ storeCategory: cat, storeId: categoryStores[0]!.id });
		} else {
			patch({ storeCategory: cat, storeId: '' });
		}
	}

	const eligiblePhones = phones.filter((p) =>
		me?.eligible_model_ids?.includes(p.id)
	);

	const categoryStores = form.storeCategory ? (stores[form.storeCategory] ?? []) : [];
	const selectedStore = categoryStores.find((s) => s.id === form.storeId);
	const selectedPhone = eligiblePhones.find((p) => p.id === form.phoneModelId);

	async function handleSubmit() {
		if (submitGuard.current) return;
		if (!form.storeId || !form.phoneModelId || form.rentalTerm === null || !form.termsAccepted) return;
		if (!form.employeeNumber || !form.idNumber) {
			setSubmitError('Please enter your employee number and ID number in Step 1.');
			return;
		}
		submitGuard.current = true;
		setSubmitting(true);
		setSubmitError('');
		try {
			const res = await api<{ data: { reference_number: string } }>('/m1/applications', {
				method: 'POST',
				body: {
					employee_number: form.employeeNumber,
					id_number: form.idNumber,
					place_of_work_category: form.storeCategory,
					place_of_work: selectedStore?.name ?? '',
					store_id: form.storeId,
					contact_number: form.contactNumber,
					email: form.email || undefined,
					phone_model_id: form.phoneModelId,
					rental_term: form.rentalTerm,
					terms_accepted: true,
				},
			});
			setSuccessRef(res.data?.reference_number ?? '');
		} catch (err) {
			submitGuard.current = false;
			setSubmitError(err instanceof Error ? err.message : 'Submission failed');
		} finally {
			setSubmitting(false);
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-48">
				<div className="text-gray-400 text-sm">Loading…</div>
			</div>
		);
	}

	if (successRef) {
		return (
			<div className="text-center space-y-4 py-8">
				<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 text-3xl mb-2">
					✓
				</div>
				<h2 className="text-xl font-bold">Application submitted!</h2>
				<p className="text-gray-600 text-sm">Your reference number is:</p>
				<p className="font-mono font-bold text-lg text-primary-700">{successRef}</p>
				<p className="text-gray-500 text-sm max-w-xs mx-auto">
					Your application will be processed when the batch closes. You will be notified of the outcome.
				</p>
				<button
					onClick={() => router.replace('/portal')}
					className="mt-4 inline-block text-sm text-primary-700 hover:text-primary-800 font-medium"
				>
					← Back to dashboard
				</button>
			</div>
		);
	}

	const STEPS = 4;

	return (
		<div>
			<div className="mb-6">
				<button onClick={() => (step === 0 ? router.replace('/portal') : setStep(step - 1))} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
					← Back
				</button>
			</div>

			<StepBar current={step} total={STEPS} />

			{step === 0 && (
				<Step1
					me={me}
					form={form}
					onChange={patch}
					onNext={() => setStep(1)}
					credentialsMissing={!form.employeeNumber || !form.idNumber}
				/>
			)}
			{step === 1 && (
				<Step2
					availableCategories={availableCategories}
					categoryStores={categoryStores}
					categoryLabel={categoryLabel}
					singleStoreKeys={singleStoreKeys}
					form={form}
					onChange={patch}
					onCategoryChange={handleCategoryChange}
					onNext={() => setStep(2)}
				/>
			)}
			{step === 2 && (
				<Step3
					phones={eligiblePhones}
					form={form}
					onChange={patch}
					onNext={() => setStep(3)}
					salaryBand={me?.salary_band}
					multiplier={multiplier}
				/>
			)}
			{step === 3 && (
				<Step4
					form={form}
					me={me}
					selectedStore={selectedStore}
					selectedPhone={selectedPhone}
					onChange={patch}
					onSubmit={handleSubmit}
					submitting={submitting}
					error={submitError}
				/>
			)}
		</div>
	);
}

// ── Step 1: Contact Details ───────────────────────────────────────────────────

function Step1({
	me,
	form,
	onChange,
	onNext,
	credentialsMissing,
}: {
	me: Me | null;
	form: FormState;
	onChange: (u: Partial<FormState>) => void;
	onNext: () => void;
	credentialsMissing: boolean;
}) {
	const canContinue =
		form.contactNumber.replace(/\D/g, '').length >= 10 &&
		(!credentialsMissing || (form.employeeNumber.trim().length > 0 && form.idNumber.trim().length > 0));

	function handleNext(e: React.FormEvent) {
		e.preventDefault();
		if (canContinue) onNext();
	}

	return (
		<form onSubmit={handleNext} className="space-y-6">
			<div>
				<h2 className="text-xl font-bold">Your details</h2>
				<p className="text-gray-500 text-sm mt-1">Step 1 of 4 - Confirm your contact number</p>
			</div>

			{me?.display_name && (
				<div>
					<label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Name</label>
					<div className="px-3 py-2.5 bg-gray-100 rounded-lg text-sm text-gray-700 font-medium">
						{me.display_name}
					</div>
				</div>
			)}

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Contact Number <span className="text-red-500">*</span>
				</label>
				<input
					type="tel"
					value={form.contactNumber}
					onChange={(e) => onChange({ contactNumber: e.target.value })}
					required
					maxLength={15}
					placeholder="e.g. 082 000 0000"
					className={inputCls()}
				/>
				<p className="text-xs text-gray-500 mt-1">
					We may use this number to contact you about your application.
				</p>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Email address <span className="text-gray-400 font-normal text-xs">(optional)</span>
				</label>
				<input
					type="email"
					value={form.email}
					onChange={(e) => onChange({ email: e.target.value })}
					placeholder="e.g. name@email.com"
					className={inputCls()}
				/>
			</div>

			{credentialsMissing && (
				<div className="space-y-4">
					<div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
						Your session has expired. Please re-enter your employee and ID numbers to continue.
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Employee Number <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={form.employeeNumber}
							onChange={(e) => onChange({ employeeNumber: e.target.value })}
							autoComplete="off"
							placeholder="e.g. 12345678"
							className={inputCls()}
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							ID Number <span className="text-red-500">*</span>
						</label>
						<input
							type="text"
							value={form.idNumber}
							onChange={(e) => onChange({ idNumber: e.target.value })}
							autoComplete="off"
							placeholder="13-digit SA ID number"
							className={inputCls()}
						/>
					</div>
				</div>
			)}

			<button
				type="submit"
				disabled={!canContinue}
				className="w-full py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Continue →
			</button>
		</form>
	);
}

// ── Step 2: Place of Work ─────────────────────────────────────────────────────

function Step2({
	availableCategories,
	categoryStores,
	categoryLabel,
	singleStoreKeys,
	form,
	onChange,
	onCategoryChange,
	onNext,
}: {
	availableCategories: CategoryRecord[];
	categoryStores: Store[];
	categoryLabel: (key: string) => string;
	singleStoreKeys: Set<string>;
	form: FormState;
	onChange: (u: Partial<FormState>) => void;
	onCategoryChange: (cat: string) => void;
	onNext: () => void;
}) {
	const isSingle = form.storeCategory ? singleStoreKeys.has(form.storeCategory) : false;

	function handleNext(e: React.FormEvent) {
		e.preventDefault();
		if (form.storeId) onNext();
	}

	return (
		<form onSubmit={handleNext} className="space-y-6">
			<div>
				<h2 className="text-xl font-bold">Place of work</h2>
				<p className="text-gray-500 text-sm mt-1">Step 2 of 4 - Where do you work?</p>
			</div>

			<div>
				<label className="block text-sm font-medium text-gray-700 mb-1">
					Store type <span className="text-red-500">*</span>
				</label>
				<select
					value={form.storeCategory}
					onChange={(e) => onCategoryChange(e.target.value)}
					required
					className={inputCls(!form.storeCategory && form.storeId !== '')}
				>
					<option value="">Select a store type…</option>
					{availableCategories.map((cat) => (
						<option key={cat.key} value={cat.key}>
							{cat.label}
						</option>
					))}
				</select>
			</div>

			{form.storeCategory && !isSingle && (
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Store name <span className="text-red-500">*</span>
					</label>
					<select
						value={form.storeId}
						onChange={(e) => onChange({ storeId: e.target.value })}
						required
						className={inputCls()}
					>
						<option value="">Select a store…</option>
						{categoryStores.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name}
							</option>
						))}
					</select>
				</div>
			)}

			{isSingle && form.storeId && categoryStores.length > 0 && (
				<div className="px-3 py-2.5 bg-gray-100 rounded-lg text-sm text-gray-700">
					{categoryStores[0]?.name}
				</div>
			)}

			<button
				type="submit"
				disabled={!form.storeId}
				className="w-full py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Continue →
			</button>
		</form>
	);
}

// ── Step 3: Phone Selection ───────────────────────────────────────────────────

function Step3({
	phones,
	form,
	onChange,
	onNext,
	salaryBand,
	multiplier,
}: {
	phones: PhoneModel[];
	form: FormState;
	onChange: (u: Partial<FormState>) => void;
	onNext: () => void;
	salaryBand?: string;
	multiplier: number;
}) {
	const bandFloor = salaryBand ? (BAND_FLOOR[salaryBand] ?? 0) : 0;

	function selectOption(phoneModelId: string, rentalTerm: 0 | 7 | 13) {
		onChange({ phoneModelId, rentalTerm });
	}

	if (phones.length === 0) {
		return (
			<div className="space-y-4">
				<div>
					<h2 className="text-xl font-bold">Phone selection</h2>
					<p className="text-gray-500 text-sm mt-1">Step 3 of 4</p>
				</div>
				<div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
					No phone models are available for your salary band. Please contact HR if you believe this is an error.
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-bold">Choose your phone</h2>
				<p className="text-gray-500 text-sm mt-1">Step 3 of 4 - Select a phone and payment option</p>
			</div>

			<div className="space-y-4">
				{phones.map((phone) => {
					const canCash = bandFloor >= phone.cash_price * multiplier;

					const options: { label: string; sublabel: string; term: 0 | 7 | 13 }[] = [
						...(canCash ? [{
							label: 'Buy for cash',
							sublabel: `${zar(phone.cash_price)} deducted once from salary`,
							term: 0 as const,
						}] : []),
						{
							label: '7-month rental',
							sublabel: `First deduction ${zar(phone.upfront_amount)}, then ${zar(phone.rental_amount_7m)}/month × 6`,
							term: 7 as const,
						},
						{
							label: '13-month rental',
							sublabel: `First deduction ${zar(phone.upfront_amount)}, then ${zar(phone.rental_amount_13m)}/month × 12`,
							term: 13 as const,
						},
					];

					return (
						<div
							key={phone.id}
							className={`bg-white border rounded-xl overflow-hidden transition-all ${
								form.phoneModelId === phone.id ? 'border-primary-500 shadow-sm' : 'border-gray-200'
							}`}
						>
							<div className="px-4 py-3 border-b border-gray-100">
								<p className="font-semibold">{phone.model_name}</p>
							</div>
							<div className="divide-y divide-gray-100">
								{options.map(({ label, sublabel, term }) => {
									const selected = form.phoneModelId === phone.id && form.rentalTerm === term;
									return (
										<button
											key={term}
											type="button"
											onClick={() => selectOption(phone.id, term)}
											className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
												selected ? 'bg-primary-50' : 'hover:bg-gray-50'
											}`}
										>
											<div>
												<p className={`text-sm font-medium ${selected ? 'text-primary-800' : 'text-gray-700'}`}>
													{label}
												</p>
												<p className="text-xs text-gray-500">{sublabel}</p>
											</div>
											<div
												className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
													selected ? 'border-primary-700 bg-primary-700' : 'border-gray-300'
												}`}
											>
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

			<button
				type="button"
				disabled={!form.phoneModelId || form.rentalTerm === null}
				onClick={onNext}
				className="w-full py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Continue →
			</button>
		</div>
	);
}

// ── Step 4: Review & Submit ───────────────────────────────────────────────────

function Step4({
	form,
	me,
	selectedStore,
	selectedPhone,
	onChange,
	onSubmit,
	submitting,
	error,
}: {
	form: FormState;
	me: Me | null;
	selectedStore: Store | undefined;
	selectedPhone: PhoneModel | undefined;
	onChange: (u: Partial<FormState>) => void;
	onSubmit: () => void;
	submitting: boolean;
	error: string;
}) {
	const termLabel =
		form.rentalTerm === 0
			? `Cash - ${selectedPhone ? zar(selectedPhone.cash_price) : ''} deducted once`
			: form.rentalTerm === 7
			? `7-month rental - First deduction ${selectedPhone ? zar(selectedPhone.upfront_amount) : ''}, then ${selectedPhone ? zar(selectedPhone.rental_amount_7m) : ''}/month × 6`
			: `13-month rental - First deduction ${selectedPhone ? zar(selectedPhone.upfront_amount) : ''}, then ${selectedPhone ? zar(selectedPhone.rental_amount_13m) : ''}/month × 12`;

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-bold">Review & confirm</h2>
				<p className="text-gray-500 text-sm mt-1">Step 4 of 4 - Check your details before submitting</p>
			</div>

			<div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
				<Row label="Name" value={me?.display_name ?? '-'} />
				<Row label="Employee number" value={form.employeeNumber || '-'} />
				<Row label="Contact number" value={form.contactNumber} />
				<Row label="Place of work" value={selectedStore?.name ?? '-'} />
				<Row label="Phone" value={selectedPhone?.model_name ?? '-'} />
				<Row label="Payment" value={termLabel} />
			</div>

			{/* Terms */}
			<label className="flex items-start gap-3 cursor-pointer">
				<input
					type="checkbox"
					checked={form.termsAccepted}
					onChange={(e) => onChange({ termsAccepted: e.target.checked })}
					className="mt-0.5 w-4 h-4 accent-primary-700 rounded"
				/>
				<span className="text-sm text-gray-700 leading-relaxed">
					I confirm that the above information is correct. I agree to the Boxer Staff Phone Rental terms and
					conditions and authorise the payroll deductions applicable to my selected option.
				</span>
			</label>

			{error && (
				<div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
					{error}
				</div>
			)}

			<button
				type="button"
				disabled={!form.termsAccepted || submitting}
				onClick={onSubmit}
				className="w-full py-3 bg-primary-700 hover:bg-primary-800 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				{submitting ? 'Submitting…' : 'Submit Application'}
			</button>
		</div>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex justify-between gap-4 px-4 py-3">
			<span className="text-sm text-gray-500 shrink-0">{label}</span>
			<span className="text-sm font-medium text-gray-900 text-right">{value}</span>
		</div>
	);
}
