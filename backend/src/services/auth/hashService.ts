import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

function getSecret(): string {
	const secret = process.env.HMAC_SECRET;
	if (!secret) throw new Error('HMAC_SECRET env var is not set');
	return secret;
}

// Deterministic keyed hash for PII fields (employee numbers, ID numbers).
// Uses HMAC-SHA256 so the same input always produces the same output, enabling
// indexed DB lookups. The key must never leave the server.
export function hmacHash(value: string): string {
	return crypto.createHmac('sha256', getSecret()).update(value.trim().toLowerCase()).digest('hex');
}

export function hmacCompare(plain: string, stored: string): boolean {
	const computed = hmacHash(plain);
	if (computed.length !== stored.length) return false;
	return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(stored));
}

// bcrypt for admin passwords only
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, ROUNDS);
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
	return bcrypt.compare(password, hashed);
}
