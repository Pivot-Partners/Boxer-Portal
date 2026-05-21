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
		<div className="min-h-screen flex flex-col">
			<header className="bg-primary-700 text-white sticky top-0 z-10">
				<div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="font-bold text-white/90">B</span>
						<span className="text-sm font-medium">Phone Rental</span>
					</div>
					<button
						onClick={logout}
						disabled={loggingOut}
						className="text-sm text-white/70 hover:text-white disabled:opacity-50 transition-colors"
					>
						Sign out
					</button>
				</div>
			</header>
			<main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">{children}</main>
		</div>
	);
}
