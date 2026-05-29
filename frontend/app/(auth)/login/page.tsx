'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Tab = 'employee' | 'admin';

const inputCls =
	'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
			{children}
		</div>
	);
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
	return (
		<button
			type="submit"
			disabled={loading}
			className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed tracking-wide"
		>
			{loading ? 'Please wait…' : label}
		</button>
	);
}

export default function LoginPage() {
	const router = useRouter();
	const [tab, setTab] = useState<Tab>('employee');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const [empNo, setEmpNo] = useState('');
	const [idNo, setIdNo] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	function switchTab(t: Tab) {
		setTab(t);
		setError('');
	}

	async function handleEmployee(e: FormEvent) {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			await api('/auth/employee', {
				method: 'POST',
				body: { employee_number: empNo.trim(), id_number: idNo.trim() },
			});
			// Keep credentials in sessionStorage so the apply form can include them
			// in the submission body for encrypted storage. Cleared when tab closes.
			sessionStorage.setItem('boxer_emp_no', empNo.trim());
			sessionStorage.setItem('boxer_id_no', idNo.trim());
			router.replace('/portal');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed');
		} finally {
			setLoading(false);
		}
	}

	async function handleAdmin(e: FormEvent) {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			await api('/auth/admin', {
				method: 'POST',
				body: { email: email.trim(), password },
			});
			router.replace('/admin');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center p-4 bg-[#1a1a1a]">
			<div className="w-full max-w-[400px]">
				<div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
					{/* Brand header */}
					<div className="bg-primary-600 px-8 py-6">
						<div className="flex items-center gap-4">
							<div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
								<span className="text-white font-black text-xl leading-none select-none">B</span>
							</div>
							<div>
								<p className="text-white font-black text-2xl tracking-widest leading-tight">BOXER</p>
								<p className="text-white/65 text-xs tracking-wide mt-0.5">Operations Portal</p>
							</div>
						</div>
					</div>

					{/* Tabs */}
					<div className="flex border-b border-gray-200 bg-gray-50/70">
						{(['employee', 'admin'] as Tab[]).map((t) => (
							<button
								key={t}
								onClick={() => switchTab(t)}
								className={`flex-1 py-3.5 text-sm font-semibold transition-colors border-b-2 ${
									tab === t
										? 'text-primary-600 border-primary-600 bg-white'
										: 'text-gray-500 border-transparent hover:text-gray-700'
								}`}
							>
								{t === 'employee' ? 'Employee / Manager' : 'Admin'}
							</button>
						))}
					</div>

					{/* Form body */}
					<div className="px-8 py-7">
						{error && (
							<div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
								<svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
									<circle cx="12" cy="12" r="10" />
									<path strokeLinecap="round" d="M12 8v4M12 16h.01" />
								</svg>
								{error}
							</div>
						)}

						{tab === 'employee' ? (
							<form onSubmit={handleEmployee} className="space-y-4">
								<Field label="Employee Number">
									<input
										type="text"
										value={empNo}
										onChange={(e) => setEmpNo(e.target.value)}
										required
										autoComplete="off"
										placeholder="e.g. 12345678"
										className={inputCls}
									/>
								</Field>
								<Field label="ID Number">
									<input
										type="text"
										value={idNo}
										onChange={(e) => setIdNo(e.target.value)}
										required
										autoComplete="off"
										placeholder="13-digit SA ID number"
										className={inputCls}
									/>
								</Field>
								<div className="pt-1">
									<SubmitBtn loading={loading} label="Sign In" />
								</div>
								<p className="text-xs text-gray-400 text-center">
									Your details are verified against the HR whitelist.
								</p>
							</form>
						) : (
							<form onSubmit={handleAdmin} className="space-y-4">
								<Field label="Email Address">
									<input
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
										autoComplete="email"
										className={inputCls}
									/>
								</Field>
								<Field label="Password">
									<input
										type="password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
										autoComplete="current-password"
										className={inputCls}
									/>
								</Field>
								<div className="pt-1">
									<SubmitBtn loading={loading} label="Sign In" />
								</div>
							</form>
						)}
					</div>
				</div>

				<p className="text-center text-xs text-gray-600 mt-5">
					Confidential - Boxer Stores Internal System
				</p>
			</div>
		</div>
	);
}
