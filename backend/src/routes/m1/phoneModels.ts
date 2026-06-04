import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const SALARY_BANDS = ['>3600', '>4400', '>6596', '>8796', '>13595', '>17196'] as const;
const BAND_VALUES = [3600, 4400, 6596, 8796, 13595, 17196] as const;

function calcMinBand(upfrontAmount: number, multiplier: number): typeof SALARY_BANDS[number] {
  const required = upfrontAmount * multiplier;
  for (let i = 0; i < BAND_VALUES.length; i++) {
    if (BAND_VALUES[i]! >= required) return SALARY_BANDS[i]!;
  }
  return SALARY_BANDS[SALARY_BANDS.length - 1]!;
}

async function getSalaryMultiplier(db: any): Promise<number> {
  const { data } = await db.from('system_config').select('config_value').eq('config_key', 'm1_salary_threshold_pct').single();
  const pct = parseFloat(data?.config_value ?? '25');
  return 100 / (pct > 0 ? pct : 25);
}

const phoneModelSchema = z.object({
  model_name: z.string().min(1),
  model_code: z.string().optional(),
  cash_price: z.number().positive(),
  upfront_amount: z.number().positive(),
  rental_amount_7m: z.number().positive(),
  rental_amount_13m: z.number().positive(),
  display_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

const phoneModelsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/m1/phone-models', async (request, reply) => {
    // When a batch is open, return locked prices from the batch catalogue so
    // employees see exactly what they will be charged. source_model_id is
    // returned as 'id' so eligible_model_ids matching in the JWT still works.
    const { data: openBatch } = await fastify.db
      .from('batches')
      .select('id')
      .eq('status', 'open')
      .single();

    if (openBatch) {
      const { data: catalogue, error: catError } = await fastify.db
        .from('batch_phone_catalogue')
        .select('source_model_id, model_name, model_code, cash_price, upfront_amount, rental_amount_7m, rental_amount_13m, display_order')
        .eq('batch_id', openBatch.id)
        .eq('is_available', true)
        .order('display_order');

      if (!catError && catalogue && catalogue.length > 0) {
        return reply.send({
          success: true,
          data: catalogue.map((m: any) => ({ ...m, id: m.source_model_id })),
        });
      }
    }

    // No open batch or catalogue is empty — fall back to master phone_models
    const { data, error } = await fastify.db
      .from('phone_models')
      .select('id, model_name, model_code, cash_price, upfront_amount, rental_amount_7m, rental_amount_13m, display_order, is_active')
      .eq('is_active', true)
      .order('display_order');

    if (error) return reply.code(500).send({ success: false, error: 'Failed to fetch phone models' });
    return reply.send({ success: true, data });
  });

  fastify.get('/m1/phone-models/all', {
    preHandler: fastify.requireRole('m1_admin', 'super_admin'),
  }, async (request, reply) => {
    const { data, error } = await fastify.db
      .from('phone_models')
      .select('*')
      .order('display_order');

    if (error) return reply.code(500).send({ success: false, error: 'Failed to fetch phone models' });
    return reply.send({ success: true, data });
  });

  fastify.post('/m1/phone-models', {
    preHandler: fastify.requireRole('m1_admin', 'super_admin'),
  }, async (request, reply) => {
    const body = phoneModelSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(422).send({ success: false, error: 'Invalid input', details: body.error.flatten() });
    }

    const displayOrder = body.data.display_order ?? 0;
    const { data: toShift } = await fastify.db
      .from('phone_models')
      .select('id, display_order')
      .gte('display_order', displayOrder);

    if (toShift && toShift.length > 0) {
      await Promise.all(
        (toShift as { id: string; display_order: number }[]).map((m) =>
          fastify.db.from('phone_models').update({ display_order: m.display_order + 1 }).eq('id', m.id)
        )
      );
    }

    const multiplier = await getSalaryMultiplier(fastify.db);
    const { data, error } = await fastify.db
      .from('phone_models')
      .insert({ ...body.data, display_order: displayOrder, min_salary_band: calcMinBand(body.data.upfront_amount, multiplier) })
      .select()
      .single();

    if (error) return reply.code(500).send({ success: false, error: 'Failed to create phone model' });
    return reply.code(201).send({ success: true, data });
  });

  fastify.patch('/m1/phone-models/:id', {
    preHandler: fastify.requireRole('m1_admin', 'super_admin'),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = phoneModelSchema.partial().safeParse(request.body);
    if (!body.success) {
      return reply.code(422).send({ success: false, error: 'Invalid input', details: body.error.flatten() });
    }

    const patchData: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
    if (body.data.upfront_amount !== undefined) {
      const multiplier = await getSalaryMultiplier(fastify.db);
      patchData.min_salary_band = calcMinBand(body.data.upfront_amount, multiplier);
    }

    const { data, error } = await fastify.db
      .from('phone_models')
      .update(patchData)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ success: false, error: 'Failed to update phone model' });
    return reply.send({ success: true, data });
  });
};

export default phoneModelsRoute;
