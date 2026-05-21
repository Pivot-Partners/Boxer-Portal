import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../../plugins/auth';
import type { Role } from '../../../../shared/types/index';

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is required');
  return s;
};

const refreshSecret = () => {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET is required');
  return s;
};

export function issueEmployeeToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, secret(), { expiresIn: '4h' });
}

export function issueStoreManagerToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, secret(), { expiresIn: '8h' });
}

export function issueAdminToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, secret(), { expiresIn: '15m' });
}

export function issueRefreshToken(sessionId: string, role: Role): string {
  return jwt.sign({ sub: sessionId, role }, refreshSecret(), { expiresIn: '7d' });
}

export function verifyRefreshToken(token: string): { sub: string; role: Role } {
  return jwt.verify(token, refreshSecret()) as { sub: string; role: Role };
}
