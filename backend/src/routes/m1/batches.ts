import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';

const batchRoute: FastifyPluginAsync = async (fastify) => {
  // Get current open batch (public — used by employee form to check if applications open)
  fastify.get('/m1/batches/current', async (request, reply) => {
    const { data } = await fastify.db
      .from('batches')
      .select('id, batch_month, cutoff_at, status')
      .eq('status', 'open')
      .single();

    return reply.send({ success: true, data: data ?? null });
  });

  // Admin — list all batches
  fastify.get('/m1/batches', {
    preHandler: fastify.requireRole('m1_admin', 'super_admin'),
  }, async (request, reply) => {
    const { data, error } = await fastify.db
      .from('batches')
      .select('id, batch_month, cutoff_at, status, total_applications, valid_applications, approved_at, approved_by')
      .order('batch_month', { ascending: false });

    if (error) return reply.code(500).send({ success: false, error: 'Failed to fetch batches' });
    return reply.send({ success: true, data });
  });

  // Admin — open a new batch
  fastify.post('/m1/batches', {
    preHandler: fastify.requireRole('m1_admin', 'super_admin'),
  }, async (request, reply) => {
    const { batch_month, cutoff_at } = request.body as { batch_month: string; cutoff_at: string };

    // Ensure no other batch is open
    const { data: existing } = await fastify.db
      .from('batches')
      .select('id')
      .eq('status', 'open')
      .single();

    if (existing) {
      return reply.code(400).send({ success: false, error: 'A batch is already open' });
    }

    const { data, error } = await fastify.db
      .from('batches')
      .insert({
        id: crypto.randomUUID(),
        batch_month,
        cutoff_at,
        status: 'open',
      })
      .select()
      .single();

    if (error) return reply.code(500).send({ success: false, error: 'Failed to create batch' });
    return reply.code(201).send({ success: true, data });
  });

  // Admin — approve batch and generate output
  fastify.post('/m1/batches/:id/approve', {
    preHandler: fastify.requireRole('m1_admin', 'super_admin'),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const now = new Date().toISOString();

    const { data: batch, error: batchError } = await fastify.db
      .from('batches')
      .select('id, status')
      .eq('id', id)
      .single();

    if (batchError || !batch) {
      return reply.code(404).send({ success: false, error: 'Batch not found' });
    }

    if (batch.status !== 'awaiting_approval') {
      return reply.code(400).send({ success: false, error: `Batch is ${batch.status}, not awaiting approval` });
    }

    await fastify.db
      .from('batches')
      .update({
        status: 'approved',
        approved_by: request.jwtPayload.user_id,
        approved_at: now,
      })
      .eq('id', id);

    // Promote validated applications to converted_to_order
    await fastify.db
      .from('applications')
      .update({ status: 'converted_to_order' })
      .eq('batch_id', id)
      .eq('status', 'validated');

    return reply.send({ success: true, message: 'Batch approved. Excel generation triggered.' });
  });
};

export default batchRoute;
