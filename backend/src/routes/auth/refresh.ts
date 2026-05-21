import type { FastifyPluginAsync } from 'fastify';
import { verifyRefreshToken, issueAdminToken } from '../../services/auth/jwtService';
import crypto from 'crypto';

const refreshRoute: FastifyPluginAsync = async (fastify) => {
	fastify.post('/auth/refresh', async (request, reply) => {
		const refreshToken = request.cookies?.refresh_token;
		if (!refreshToken) {
			return reply.code(401).send({ success: false, error: 'No refresh token' });
		}

		let sub: string;
		let role: string;
		try {
			const decoded = verifyRefreshToken(refreshToken);
			sub = decoded.sub;
			role = decoded.role;
		} catch {
			return reply.code(401).send({ success: false, error: 'Invalid or expired refresh token' });
		}

		const { data: session } = await fastify.db
			.from('sessions')
			.select('id, user_id, role_name')
			.eq('id', sub)
			.is('revoked_at', null)
			.single();

		if (!session) {
			return reply.code(401).send({ success: false, error: 'Session expired or revoked' });
		}

		const { data: user } = await fastify.db
			.from('users')
			.select('id, email, full_name, is_active')
			.eq('id', session.user_id)
			.single();

		if (!user || !user.is_active) {
			return reply.code(401).send({ success: false, error: 'User not found or inactive' });
		}

		const newToken = issueAdminToken({
			sub: session.id,
			type: 'admin',
			role: session.role_name,
			user_id: user.id,
			full_name: user.full_name,
			email: user.email,
		});

		const tokenHash = crypto.createHash('sha256').update(newToken).digest('hex');
		await fastify.db
			.from('sessions')
			.update({
				token_hash: tokenHash,
				expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			})
			.eq('id', session.id);

		reply.setCookie('token', newToken, {
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			path: '/',
			maxAge: 15 * 60,
		});

		return reply.send({ success: true });
	});
};

export default refreshRoute;
