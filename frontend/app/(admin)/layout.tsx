'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const NAV = [
	{ label: 'Dashboard', href: '/admin' },
	{ label: 'Whitelist', href: '/admin/whitelist' },
	{ label: 'Batches', href: '/admin/batches' },
	{ label: 'Phone Models', href: '/admin/phones' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
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
			<header className="bg-gray-900 text-white">
				<div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
					<div className="flex items-center gap-6">
						<span className="font-bold text-sm">Boxer Admin</span>
						<nav className="hidden sm:flex items-center gap-1">
							{NAV.map(({ label, href }) => {
								const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
								return (
									<Link
										key={href}
										href={href}
										className={`px-3 py-1.5 rounded text-sm transition-colors ${
											active ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
										}`}
									>
										{label}
									</Link>
								);
							})}
						</nav>
					</div>
					<button
						onClick={logout}
						disabled={loggingOut}
						className="text-sm text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
					>
						Sign out
					</button>
				</div>
			</header>

			{/* Mobile nav */}
			<div className="sm:hidden bg-gray-800 border-b border-gray-700 overflow-x-auto">
				<div className="flex px-4">
					{NAV.map(({ label, href }) => {
						const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
						return (
							<Link
								key={href}
								href={href}
								className={`shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
									active ? 'border-white text-white' : 'border-transparent text-gray-400'
								}`}
							>
								{label}
							</Link>
						);
					})}
				</div>
			</div>

			<main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">{children}</main>
		</div>
	);
}
