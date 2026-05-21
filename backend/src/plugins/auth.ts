import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import type { Role } from '../../../shared/types/index';

export interface JwtPayload {
  sub: string; // session_id
  type: 'employee' | 'store_manager' | 'admin';
  role: Role;
  employee_number_hash?: string;
  display_name?: string;
  place_of_work?: string;
  store_code?: string;
  salary_band?: string;
  eligible_model_ids?: string[];
  user_id?: string;
  full_name?: string;
  email?: string;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: Role[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    jwtPayload: JwtPayload;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies?.token;
    if (!token) {
      return reply.code(401).send({ success: false, error: 'Unauthorised' });
    }

    try {
      const payload = jwt.verify(token, secret) as JwtPayload;
      request.jwtPayload = payload;
    } catch {
      return reply.code(401).send({ success: false, error: 'Invalid or expired session' });
    }
  });

  fastify.decorate('requireRole', (...roles: Role[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;
      if (!roles.includes(request.jwtPayload.role)) {
        return reply.code(403).send({ success: false, error: 'Forbidden' });
      }
    };
  });
};

export default fp(authPlugin, { name: 'auth', dependencies: ['database'] });
