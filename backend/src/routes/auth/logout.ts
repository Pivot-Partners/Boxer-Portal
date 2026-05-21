import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';

const logoutRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/logout', {
    preHandler: fastify.authenticate,
  }, async (request, reply) => {
    const token = request.cookies?.token;
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await fastify.db
        .from('sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('token_hash', tokenHash);
    }

    reply
      .clearCookie('token', { path: '/' })
      .clearCookie('refresh_token', { path: '/v1/auth/refresh' });

    return reply.send({ success: true });
  });
};

export default logoutRoute;
