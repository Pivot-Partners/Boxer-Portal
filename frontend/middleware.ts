import { NextRequest, NextResponse } from 'next/server';

const ADMIN_ROLES = new Set(['super_admin', 'm1_admin', 'm2_admin', 'm2_reviewer']);

function decodePayload(token: string): Record<string, unknown> | null {
	try {
		const part = token.split('.')[1];
		if (!part) return null;
		const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
		return JSON.parse(atob(padded));
	} catch {
		return null;
	}
}

function isExpired(p: Record<string, unknown>): boolean {
	const exp = p.exp;
	return typeof exp === 'number' && exp < Date.now() / 1000;
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const token = request.cookies.get('token')?.value;
	const refreshToken = request.cookies.get('refresh_token')?.value;

	if (pathname === '/') {
		return NextResponse.redirect(new URL('/login', request.url));
	}

	if (pathname.startsWith('/login')) {
		if (token) {
			const p = decodePayload(token);
			if (p && !isExpired(p) && typeof p.role === 'string') {
				return NextResponse.redirect(new URL(ADMIN_ROLES.has(p.role) ? '/admin' : '/portal', request.url));
			}
		}
		return NextResponse.next();
	}

	if (!token) {
		return NextResponse.redirect(new URL('/login', request.url));
	}

	const payload = decodePayload(token);

	if (!payload || isExpired(payload)) {
		if (refreshToken) {
			const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/v1';
			const baseUrl = base.startsWith('http')
				? base
				: `${request.nextUrl.protocol}//${request.nextUrl.host}${base}`;
			try {
				const res = await fetch(`${baseUrl}/auth/refresh`, {
					method: 'POST',
					headers: { Cookie: `refresh_token=${refreshToken}` },
				});
				if (res.ok) {
					const setCookies = res.headers.getSetCookie?.() ?? [];
					const next = NextResponse.next();
					for (const c of setCookies) next.headers.append('Set-Cookie', c);
					return next;
				}
			} catch {
				// fall through to redirect
			}
		}
		const res = NextResponse.redirect(new URL('/login', request.url));
		res.cookies.delete('token');
		res.cookies.delete('refresh_token');
		return res;
	}

	const role = payload.role as string;

	if (pathname.startsWith('/admin') && !ADMIN_ROLES.has(role)) {
		return NextResponse.redirect(new URL('/portal', request.url));
	}
	if (pathname.startsWith('/portal') && ADMIN_ROLES.has(role)) {
		return NextResponse.redirect(new URL('/admin', request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico|api/v1/).*)'],
};
