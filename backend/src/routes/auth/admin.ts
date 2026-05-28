import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { comparePassword } from '../../services/auth/hashService';
import { issueAdminToken, issueRefreshToken } from '../../services/auth/jwtService';
import crypto from 'crypto';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const adminAuthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/admin', async (request, reply) => {
    const body = schema.safeParse(request.body);
    if (!body.success) {
      return reply.code(422).send({ success: false, error: 'Invalid input' });
    }

    const { email, password } = body.data;

    const { data: user } = await fastify.db
      .from('users')
      .select('id, email, password_hash, full_name, is_active, failed_login_attempts, locked_until, roles(name)')
      .eq('email', email.toLowerCase())
      .single();

    if (!user || !user.is_active) {
      return reply.code(401).send({ success: false, error: 'Invalid email or password' });
    }

    // Account lock check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return reply.code(429).send({ success: false, error: 'Account temporarily locked. Try again later.' });
    }

    const valid = await comparePassword(password, user.password_hash);

    if (!valid) {
      const attempts = (user.failed_login_attempts ?? 0) + 1;
      const maxAttempts = 5;
      const updates: Record<string, unknown> = { failed_login_attempts: attempts };
      if (attempts >= maxAttempts) {
        updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await fastify.db.from('users').update(updates).eq('id', user.id);
      return reply.code(401).send({ success: false, error: 'Invalid email or password' });
    }

    const role = (user.roles as any)?.name;
    const sessionId = crypto.randomUUID();
    const token = issueAdminToken({
      sub: sessionId,
      type: 'admin',
      role,
      user_id: user.id,
      full_name: user.full_name,
      email: user.email,
    });
    const refreshToken = issueRefreshToken(sessionId, role);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await fastify.db.from('sessions').insert({
      id: sessionId,
      session_type: 'admin',
      user_id: user.id,
      role_name: role,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ip_address: request.ip,
    });

    await fastify.db.from('users').update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    }).eq('id', user.id);

    reply
      .setCookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 15 * 60,
      })
      .setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

    return reply.send({
      success: true,
      data: {
        role,
        full_name: user.full_name,
        email: user.email,
      },
    });
  });
};

export default adminAuthRoute;
