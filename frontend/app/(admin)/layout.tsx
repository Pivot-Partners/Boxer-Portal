'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const NAV = [
	{
		label: 'Dashboard',
		href: '/admin',
		icon: (
			<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<rect x="3" y="3" width="7" height="7" rx="1" />
				<rect x="14" y="3" width="7" height="7" rx="1" />
				<rect x="3" y="14" width="7" height="7" rx="1" />
				<rect x="14" y="14" width="7" height="7" rx="1" />
			</svg>
		),
	},
	{
		label: 'Applications',
		href: '/admin/applications',
		icon: (
			<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				<path strokeLinecap="round" d="M9 12h6M9 16h4" />
			</svg>
		),
	},
	{
		label: 'Whitelist',
		href: '/admin/whitelist',
		icon: (
			<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4" />
			</svg>
		),
	},
	{
		label: 'Batches',
		href: '/admin/batches',
		icon: (
			<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5z" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M2 17l10 5 10-5" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M2 12l10 5 10-5" />
			</svg>
		),
	},
	{
		label: 'Phone Models',
		href: '/admin/phones',
		icon: (
			<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<rect x="5" y="2" width="14" height="20" rx="2" />
				<path strokeLinecap="round" d="M12 18h.01" />
			</svg>
		),
	},
	{
		label: 'Stores',
		href: '/admin/stores',
		icon: (
			<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
			</svg>
		),
	},
	{
		label: 'Users',
		href: '/admin/users',
		icon: (
			<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<circle cx="9" cy="7" r="4" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M19 8v6M22 11h-6" />
			</svg>
		),
	},
	{
		label: 'Config',
		href: '/admin/config',
		icon: (
			<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
				<circle cx="12" cy="12" r="3" />
				<path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
			</svg>
		),
	},
];

function SidebarInner({
	pathname,
	loggingOut,
	onLogout,
	onClose,
}: {
	pathname: string;
	loggingOut: boolean;
	onLogout: () => void;
	onClose?: () => void;
}) {
	return (
		<div className="flex flex-col h-full">
			{/* Brand */}
			<div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
				<div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
					<span className="text-white font-black text-base leading-none select-none">B</span>
				</div>
				<div>
					<p className="text-white font-black text-base tracking-widest leading-tight">BOXER</p>
					<p className="text-gray-500 text-xs leading-tight mt-0.5">Operations Portal</p>
				</div>
			</div>

			{/* Nav */}
			<nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
				<p className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.12em] px-3 mb-3">
					Main Menu
				</p>
				{NAV.map(({ label, href, icon }) => {
					const active =
						pathname === href || (href !== '/admin' && pathname.startsWith(href));
					return (
						<Link
							key={href}
							href={href}
							onClick={onClose}
							className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
								active
									? 'bg-slate-700 text-white shadow-sm'
									: 'text-gray-400 hover:text-white hover:bg-white/10'
							}`}
						>
							{icon}
							{label}
						</Link>
					);
				})}
			</nav>

			{/* Sign out */}
			<div className="px-3 pb-5 pt-3 border-t border-white/10">
				<button
					onClick={onLogout}
					disabled={loggingOut}
					className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
				>
					<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
						<path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5M21 12H9" />
					</svg>
					{loggingOut ? 'Signing out…' : 'Sign out'}
				</button>
			</div>
		</div>
	);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [loggingOut, setLoggingOut] = useState(false);
	const [showIdleWarning, setShowIdleWarning] = useState(false);
	const lastActivityRef = useRef(Date.now());

	useEffect(() => {
		function resetActivity() {
			lastActivityRef.current = Date.now();
			setShowIdleWarning(false);
		}
		window.addEventListener('mousemove', resetActivity, { passive: true });
		window.addEventListener('keydown', resetActivity);
		window.addEventListener('click', resetActivity);
		const id = setInterval(() => {
			if (Date.now() - lastActivityRef.current >= 12 * 60 * 1000) setShowIdleWarning(true);
		}, 30_000);
		return () => {
			window.removeEventListener('mousemove', resetActivity);
			window.removeEventListener('keydown', resetActivity);
			window.removeEventListener('click', resetActivity);
			clearInterval(id);
		};
	}, []);

	async function stayLoggedIn() {
		try {
			await api('/auth/refresh', { method: 'POST' });
		} catch {
			router.replace('/login');
			return;
		}
		lastActivityRef.current = Date.now();
		setShowIdleWarning(false);
	}

	async function logout() {
		setLoggingOut(true);
		try {
			await api('/auth/logout', { method: 'POST' });
		} finally {
			router.replace('/login');
		}
	}

	return (
		<div className="min-h-screen bg-gray-50 flex">
			{/* Desktop sidebar */}
			<aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-[#1a1a1a] z-30">
				<SidebarInner
					pathname={pathname}
					loggingOut={loggingOut}
					onLogout={logout}
				/>
			</aside>

			{/* Mobile sidebar overlay */}
			{sidebarOpen && (
				<>
					<div
						className="fixed inset-0 bg-black/60 z-40 lg:hidden"
						onClick={() => setSidebarOpen(false)}
					/>
					<aside className="fixed inset-y-0 left-0 w-64 bg-[#1a1a1a] z-50 lg:hidden flex flex-col">
						<SidebarInner
							pathname={pathname}
							loggingOut={loggingOut}
							onLogout={logout}
							onClose={() => setSidebarOpen(false)}
						/>
					</aside>
				</>
			)}

			{/* Main content area */}
			<div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
				{/* Mobile top bar */}
				<header className="lg:hidden sticky top-0 z-20 bg-[#1a1a1a] px-4 h-14 flex items-center gap-4 shadow-md">
					<button
						onClick={() => setSidebarOpen(true)}
						className="text-gray-300 hover:text-white transition-colors p-1"
						aria-label="Open menu"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
							<path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>
					<div className="flex items-center gap-2.5">
						<div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
							<span className="text-white font-black text-xs leading-none">B</span>
						</div>
						<span className="text-white font-black text-sm tracking-widest">BOXER</span>
						<span className="text-gray-500 text-xs hidden sm:inline">Operations Portal</span>
					</div>
				</header>

				<main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 w-full">
					{children}
				</main>
			</div>

			{showIdleWarning && (
				<div className="fixed bottom-4 right-4 z-50 bg-amber-50 border border-amber-300 rounded-xl shadow-lg p-4 flex items-center gap-4 max-w-sm">
					<p className="text-sm text-amber-800 flex-1">Your session is about to expire due to inactivity.</p>
					<button
						onClick={stayLoggedIn}
						className="text-sm font-semibold text-amber-900 hover:underline shrink-0"
					>
						Stay logged in
					</button>
				</div>
			)}
		</div>
	);
}
