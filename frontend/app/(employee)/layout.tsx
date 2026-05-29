'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const [loggingOut, setLoggingOut] = useState(false);

	async function logout() {
		setLoggingOut(true);
		try {
			await api('/auth/logout', { method: 'POST' });
		} finally {
			router.replace('/login');
		}
	}

	return (
		<div className="min-h-screen flex flex-col bg-gray-50">
			<header className="bg-primary-600 text-white sticky top-0 z-10 shadow-md">
				<div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
							<span className="text-white font-black text-sm leading-none select-none">B</span>
						</div>
						<div className="flex items-baseline gap-2">
							<span className="font-black text-base tracking-widest">BOXER</span>
							<span className="text-white/60 text-xs hidden sm:inline">Phone Rental Scheme</span>
						</div>
					</div>
					<button
						onClick={logout}
						disabled={loggingOut}
						className="text-sm text-white/70 hover:text-white disabled:opacity-50 transition-colors font-medium"
					>
						{loggingOut ? 'Signing out…' : 'Sign out'}
					</button>
				</div>
			</header>
			<main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">{children}</main>
			<footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-200">
				Boxer Stores - Staff Phone Rental Scheme &nbsp;·&nbsp; Internal Use Only
			</footer>
		</div>
	);
}
