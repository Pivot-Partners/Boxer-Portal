'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Tab = 'employee' | 'admin';

const inputCls =
	'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div>
			<label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
			{children}
		</div>
	);
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
	return (
		<button
			type="submit"
			disabled={loading}
			className="w-full py-2.5 px-4 bg-primary-700 hover:bg-primary-800 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
		<div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-700 mb-4">
						<span className="text-white text-xl font-bold select-none">B</span>
					</div>
					<h1 className="text-2xl font-bold text-gray-900">Boxer Operations Portal</h1>
					<p className="text-sm text-gray-500 mt-1">Staff Phone Rental Scheme</p>
				</div>

				<div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
					{/* Tabs */}
					<div className="flex border-b border-gray-200">
						{(['employee', 'admin'] as Tab[]).map((t) => (
							<button
								key={t}
								onClick={() => switchTab(t)}
								className={`flex-1 py-3 text-sm font-medium transition-colors ${
									tab === t
										? 'text-primary-700 border-b-2 border-primary-700'
										: 'text-gray-500 hover:text-gray-700'
								}`}
							>
								{t === 'employee' ? 'Employee / Store Manager' : 'Admin'}
							</button>
						))}
					</div>

					<div className="p-6">
						{error && (
							<div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
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
								<SubmitBtn loading={loading} label="Sign In" />
								<p className="text-xs text-gray-500 text-center">
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
								<SubmitBtn loading={loading} label="Sign In" />
							</form>
						)}
					</div>
				</div>

				<p className="text-center text-xs text-gray-400 mt-6">
					Confidential — Boxer Stores Internal System
				</p>
			</div>
		</div>
	);
}
