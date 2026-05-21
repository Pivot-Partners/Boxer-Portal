import type { FastifyPluginAsync } from 'fastify';

const meRoute: FastifyPluginAsync = async (fastify) => {
	fastify.get('/auth/me', {
		preHandler: fastify.authenticate,
	}, async (request, reply) => {
		const p = request.jwtPayload;
		return reply.send({
			success: true,
			data: {
				type: p.type,
				role: p.role,
				display_name: p.display_name ?? p.full_name,
				full_name: p.full_name,
				email: p.email,
				salary_band: p.salary_band,
				eligible_model_ids: p.eligible_model_ids ?? [],
				store_code: p.store_code,
				place_of_work: p.place_of_work,
			},
		});
	});
};

export default meRoute;
