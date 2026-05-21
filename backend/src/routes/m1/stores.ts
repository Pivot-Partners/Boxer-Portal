import type { FastifyPluginAsync } from 'fastify';
import type { StoreCategory } from '../../../../shared/types/index';

const storesRoute: FastifyPluginAsync = async (fastify) => {
  // Public — used by the employee application form
  fastify.get('/m1/stores', async (request, reply) => {
    const { data, error } = await fastify.db
      .from('stores')
      .select('id, category, name, store_code')
      .eq('is_active', true)
      .order('name');

    if (error) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'Failed to fetch stores' });
    }

    // Group by category for easy frontend consumption
    const grouped: Record<string, typeof data> = {};
    for (const store of data ?? []) {
      if (!grouped[store.category]) grouped[store.category] = [];
      grouped[store.category]!.push(store);
    }

    return reply.send({ success: true, data: grouped });
  });

  // Admin — toggle store active status
  fastify.patch('/m1/stores/:id', {
    preHandler: fastify.requireRole('m1_admin', 'super_admin'),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { is_active } = request.body as { is_active: boolean };

    const { error } = await fastify.db
      .from('stores')
      .update({ is_active })
      .eq('id', id);

    if (error) {
      return reply.code(500).send({ success: false, error: 'Failed to update store' });
    }

    return reply.send({ success: true });
  });
};

export default storesRoute;
