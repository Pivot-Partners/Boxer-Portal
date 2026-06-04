import type { FastifyPluginAsync } from 'fastify';

const m1ConfigRoute: FastifyPluginAsync = async (fastify) => {
	fastify.get('/m1/config', async (_request, reply) => {
		const { data } = await fastify.db
			.from('system_config')
			.select('config_value')
			.eq('config_key', 'm1_salary_threshold_pct')
			.single();

		const pct = parseFloat(data?.config_value ?? '25');
		return reply.send({ success: true, data: { salary_threshold_pct: pct > 0 ? pct : 25 } });
	});
};

export default m1ConfigRoute;
