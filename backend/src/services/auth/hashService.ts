import bcrypt from 'bcryptjs';

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

export async function hashValue(value: string): Promise<string> {
  return bcrypt.hash(value.trim().toLowerCase(), ROUNDS);
}

export async function compareValue(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain.trim().toLowerCase(), hashed);
}

// Admin passwords are case-sensitive and not lowercased
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}
