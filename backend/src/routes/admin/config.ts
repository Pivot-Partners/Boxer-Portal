import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const configRoute: FastifyPluginAsync = async (fastify) => {
	fastify.get('/admin/config', {
		preHandler: fastify.requireRole('super_admin'),
	}, async (request, reply) => {
		const { data, error } = await fastify.db
			.from('system_config')
			.select('id, module, config_key, config_value, description, updated_at')
			.order('module')
			.order('config_key');

		if (error) return reply.code(500).send({ success: false, error: 'Failed to fetch config' });
		return reply.send({ success: true, data });
	});

	fastify.patch('/admin/config/:key', {
		preHandler: fastify.requireRole('super_admin'),
	}, async (request, reply) => {
		const { key } = request.params as { key: string };
		const body = z.object({ config_value: z.string().min(1) }).safeParse(request.body);
		if (!body.success) return reply.code(422).send({ success: false, error: 'Invalid value' });

		const { data, error } = await fastify.db
			.from('system_config')
			.update({
				config_value: body.data.config_value,
				updated_by: request.jwtPayload.user_id,
				updated_at: new Date().toISOString(),
			})
			.eq('config_key', key)
			.select('id, module, config_key, config_value, description, updated_at')
			.single();

		if (error || !data) return reply.code(404).send({ success: false, error: 'Config key not found' });
		return reply.send({ success: true, data });
	});
};

export default configRoute;
