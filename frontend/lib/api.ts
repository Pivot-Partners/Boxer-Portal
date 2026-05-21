const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/v1';

interface RequestOptions extends Omit<RequestInit, 'body'> {
	body?: unknown;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
	const { body, headers, ...rest } = options;
	const res = await fetch(`${BASE}${path}`, {
		...rest,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	const json = await res.json().catch(() => null);
	if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
	return json as T;
}

export async function apiUpload<T = unknown>(path: string, formData: FormData): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		method: 'POST',
		credentials: 'include',
		body: formData,
	});
	const json = await res.json().catch(() => null);
	if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
	return json as T;
}
