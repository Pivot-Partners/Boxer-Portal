import crypto from 'crypto';

function getKey(): Buffer {
	const key = process.env.ENCRYPTION_KEY;
	if (!key) throw new Error('ENCRYPTION_KEY env var is not set');
	if (key.length !== 64) throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
	return Buffer.from(key, 'hex');
}

// AES-256-GCM. Each call generates a fresh random IV so identical plaintexts
// produce different ciphertexts. Output format: iv:authTag:ciphertext (hex, colon-delimited).
export function encrypt(plaintext: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(token: string): string {
	const parts = token.split(':');
	if (parts.length !== 3) throw new Error('Invalid encrypted token format');
	const [ivHex, authTagHex, dataHex] = parts as [string, string, string];
	const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
	decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
	return Buffer.concat([
		decipher.update(Buffer.from(dataHex, 'hex')),
		decipher.final(),
	]).toString('utf8');
}
