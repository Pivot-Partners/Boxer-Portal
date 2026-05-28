const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/v1';

interface RequestOptions extends Omit<RequestInit, 'body'> {
	body?: unknown;
}

async function silentRefresh(): Promise<boolean> {
	try {
		const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
		return res.ok;
	} catch {
		return false;
	}
}

function redirectToLogin() {
	if (typeof window !== 'undefined') {
		window.location.href = '/login';
	}
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
	const { body, headers, ...rest } = options;
	const reqInit: RequestInit = {
		...rest,
		credentials: 'include',
		headers: {
			...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
			...headers,
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	};

	let res = await fetch(`${BASE}${path}`, reqInit);

	// On 401 (excluding auth endpoints), attempt a silent token refresh then retry once
	if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/admin' && path !== '/auth/employee') {
		const refreshed = await silentRefresh();
		if (refreshed) {
			res = await fetch(`${BASE}${path}`, reqInit);
		} else {
			redirectToLogin();
			throw new Error('Session expired. Please log in again.');
		}
	}

	const json = await res.json().catch(() => null);
	if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
	return json as T;
}

export async function apiUpload<T = unknown>(path: string, formData: FormData): Promise<T> {
	const doFetch = () =>
		fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', body: formData });

	let res = await doFetch();

	if (res.status === 401) {
		const refreshed = await silentRefresh();
		if (refreshed) {
			res = await doFetch();
		} else {
			redirectToLogin();
			throw new Error('Session expired. Please log in again.');
		}
	}

	const json = await res.json().catch(() => null);
	if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
	return json as T;
}
