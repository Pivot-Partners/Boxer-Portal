'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AdminUser {
	id: string;
	email: string;
	full_name: string;
	is_active: boolean;
	created_at: string;
	last_login_at: string | null;
	roles: { name: string } | null;
}

const ROLES = ['super_admin', 'm1_admin', 'm2_admin', 'm2_reviewer'] as const;

const ROLE_LABEL: Record<string, string> = {
	super_admin: 'Super Admin',
	m1_admin: 'M1 Admin',
	m2_admin: 'M2 Admin',
	m2_reviewer: 'M2 Reviewer',
};

const ROLE_COLOUR: Record<string, string> = {
	super_admin: 'bg-purple-100 text-purple-800',
	m1_admin: 'bg-blue-100 text-blue-800',
	m2_admin: 'bg-teal-100 text-teal-800',
	m2_reviewer: 'bg-gray-100 text-gray-600',
};

function inputCls() {
	return 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500';
}

export default function UsersPage() {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [pageError, setPageError] = useState('');

	const [showForm, setShowForm] = useState(false);
	const [newEmail, setNewEmail] = useState('');
	const [newName, setNewName] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [newRole, setNewRole] = useState<typeof ROLES[number]>('m1_admin');
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState('');

	const [resetUserId, setResetUserId] = useState<string | null>(null);
	const [resetPassword, setResetPassword] = useState('');
	const [resetting, setResetting] = useState(false);
	const [resetError, setResetError] = useState('');

	const [togglingId, setTogglingId] = useState<string | null>(null);

	async function fetchUsers() {
		try {
			const res = await api<{ data: AdminUser[] }>('/admin/users');
			setUsers(res.data ?? []);
		} catch (err) {
			setPageError(err instanceof Error ? err.message : 'Failed to load users');
		}
	}

	useEffect(() => {
		fetchUsers().finally(() => setLoading(false));
	}, []);

	async function createUser(e: React.FormEvent) {
		e.preventDefault();
		setCreating(true);
		setCreateError('');
		try {
			await api('/admin/users', {
				method: 'POST',
				body: { email: newEmail, full_name: newName, password: newPassword, role: newRole },
			});
			setShowForm(false);
			setNewEmail('');
			setNewName('');
			setNewPassword('');
			setNewRole('m1_admin');
			await fetchUsers();
		} catch (err) {
			setCreateError(err instanceof Error ? err.message : 'Failed to create user');
		} finally {
			setCreating(false);
		}
	}

	async function toggleActive(user: AdminUser) {
		setTogglingId(user.id);
		try {
			await api(`/admin/users/${user.id}`, { method: 'PATCH', body: { is_active: !user.is_active } });
			setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
		} finally {
			setTogglingId(null);
		}
	}

	async function resetUserPassword(userId: string) {
		if (!resetPassword || resetPassword.length < 8) {
			setResetError('Password must be at least 8 characters');
			return;
		}
		setResetting(true);
		setResetError('');
		try {
			await api(`/admin/users/${userId}`, { method: 'PATCH', body: { new_password: resetPassword } });
			setResetUserId(null);
			setResetPassword('');
		} catch (err) {
			setResetError(err instanceof Error ? err.message : 'Reset failed');
		} finally {
			setResetting(false);
		}
	}

	if (loading) {
		return (
			<div className="space-y-6 animate-pulse">
				<div className="h-8 bg-gray-200 rounded w-40" />
				<div className="h-64 bg-gray-100 rounded-xl" />
			</div>
		);
	}

	if (pageError) {
		return (
			<div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
				{pageError === 'Forbidden' || pageError.includes('403')
					? 'This page is restricted to super admins.'
					: pageError}
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold">Admin Users</h1>
					<p className="text-gray-500 text-sm mt-1">Manage portal admin accounts</p>
				</div>
				<button
					onClick={() => setShowForm(true)}
					disabled={showForm}
					className="shrink-0 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
				>
					Add user
				</button>
			</div>

			{showForm && (
				<form onSubmit={createUser} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
					<h2 className="font-semibold">New admin account</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
							<input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} required className={inputCls()} placeholder="Jane Smith" />
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
							<input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className={inputCls()} placeholder="jane@boxer.co.za" />
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
							<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className={inputCls()} placeholder="Min. 8 characters" />
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
							<select value={newRole} onChange={(e) => setNewRole(e.target.value as typeof ROLES[number])} className={inputCls()}>
								{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
							</select>
						</div>
					</div>
					{createError && <p className="text-sm text-red-600">{createError}</p>}
					<div className="flex gap-3">
						<button type="submit" disabled={creating} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
							{creating ? 'Creating…' : 'Create account'}
						</button>
						<button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors">
							Cancel
						</button>
					</div>
				</form>
			)}

			<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
				<table className="w-full text-sm">
					<thead className="bg-gray-50 border-b border-gray-200">
						<tr>
							<th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Name</th>
							<th className="text-left px-5 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">Role</th>
							<th className="text-left px-5 py-3 text-xs font-medium text-gray-500 hidden lg:table-cell">Last login</th>
							<th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Status</th>
							<th className="px-5 py-3" />
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100">
						{users.map((user) => (
							<tr key={user.id} className={user.is_active ? '' : 'opacity-50'}>
								<td className="px-5 py-3">
									<p className="font-medium text-gray-900">{user.full_name}</p>
									<p className="text-xs text-gray-500">{user.email}</p>
								</td>
								<td className="px-5 py-3 hidden md:table-cell">
									<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLOUR[user.roles?.name ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
										{ROLE_LABEL[user.roles?.name ?? ''] ?? user.roles?.name ?? '—'}
									</span>
								</td>
								<td className="px-5 py-3 text-gray-500 text-xs hidden lg:table-cell">
									{user.last_login_at
										? new Date(user.last_login_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
										: 'Never'}
								</td>
								<td className="px-5 py-3">
									<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
										{user.is_active ? 'Active' : 'Inactive'}
									</span>
								</td>
								<td className="px-5 py-3">
									<div className="flex items-center justify-end gap-3">
										{resetUserId === user.id ? (
											<div className="flex items-center gap-2">
												<input
													type="password"
													value={resetPassword}
													onChange={(e) => setResetPassword(e.target.value)}
													placeholder="New password"
													className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 w-36"
												/>
												<button
													onClick={() => resetUserPassword(user.id)}
													disabled={resetting}
													className="text-xs font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-40"
												>
													{resetting ? '…' : 'Set'}
												</button>
												<button onClick={() => { setResetUserId(null); setResetPassword(''); setResetError(''); }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
												{resetError && <p className="text-xs text-red-600">{resetError}</p>}
											</div>
										) : (
											<button
												onClick={() => { setResetUserId(user.id); setResetError(''); }}
												className="text-xs text-gray-500 hover:text-gray-800"
											>
												Reset password
											</button>
										)}
										<button
											onClick={() => toggleActive(user)}
											disabled={togglingId === user.id}
											className="text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-40"
										>
											{togglingId === user.id ? '…' : user.is_active ? 'Deactivate' : 'Activate'}
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
