import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';

const submitSchema = z.object({
  place_of_work_category: z.string().min(1),
  place_of_work: z.string().min(1),
  store_id: z.string().uuid(),
  contact_number: z.string().min(10).max(15),
  phone_model_id: z.string().uuid(),
  rental_term: z.union([z.literal(7), z.literal(13), z.literal(0)]), // 0 = cash
  terms_accepted: z.literal(true),
});

function generateReference(month: Date): string {
  const prefix = `APP-${month.getFullYear()}${String(month.getMonth() + 1).padStart(2, '0')}`;
  const suffix = crypto.randomInt(100000, 999999).toString();
  return `${prefix}-${suffix}`;
}

const applicationsRoute: FastifyPluginAsync = async (fastify) => {
  // Employee submits application
  fastify.post('/m1/applications', {
    preHandler: fastify.requireRole('employee'),
  }, async (request, reply) => {
    const payload = request.jwtPayload;
    const body = submitSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(422).send({ success: false, error: 'Invalid input', details: body.error.flatten() });
    }

    // Check for open batch
    const { data: batch } = await fastify.db
      .from('batches')
      .select('id, status, cutoff_at')
      .eq('status', 'open')
      .single();

    if (!batch) {
      return reply.code(400).send({ success: false, error: 'Applications are not currently open' });
    }

    // Check if past cutoff
    if (new Date() > new Date(batch.cutoff_at)) {
      return reply.code(400).send({ success: false, error: 'The application deadline has passed' });
    }

    // Check active contract (active rental in DB blocks re-application)
    const { data: activeRental } = await fastify.db
      .from('rentals')
      .select('id')
      .eq('employee_number_hash', payload.employee_number_hash!)
      .eq('status', 'active')
      .single();

    if (activeRental) {
      return reply.code(400).send({ success: false, error: 'You already have an active phone rental' });
    }

    // Verify phone model is in employee's eligible list
    if (!payload.eligible_model_ids?.includes(body.data.phone_model_id)) {
      return reply.code(400).send({ success: false, error: 'You are not eligible for this phone model' });
    }

    // Supersede any existing pending application for this batch
    const { data: existing } = await fastify.db
      .from('applications')
      .select('id')
      .eq('employee_number_hash', payload.employee_number_hash!)
      .eq('batch_id', batch.id)
      .eq('status', 'pending');

    const now = new Date().toISOString();
    const newId = crypto.randomUUID();

    if (existing && existing.length > 0) {
      await fastify.db
        .from('applications')
        .update({ status: 'superseded', superseded_by_id: newId })
        .in('id', existing.map((e: any) => e.id));
    }

    const { data: store } = await fastify.db
      .from('stores')
      .select('name')
      .eq('id', body.data.store_id)
      .single();

    const { data: application, error } = await fastify.db
      .from('applications')
      .insert({
        id: newId,
        reference_number: generateReference(new Date()),
        employee_number_hash: payload.employee_number_hash,
        display_name: payload.display_name,
        place_of_work: store?.name ?? body.data.place_of_work,
        store_id: body.data.store_id,
        contact_number: body.data.contact_number,
        contact_number_updated: body.data.contact_number !== payload.place_of_work,
        phone_model_id: body.data.phone_model_id,
        rental_term: body.data.rental_term,
        terms_accepted: true,
        terms_accepted_at: now,
        status: 'pending',
        batch_id: batch.id,
        submitted_at: now,
        ip_address: request.ip,
      })
      .select('id, reference_number, status, submitted_at')
      .single();

    if (error) {
      fastify.log.error(error);
      return reply.code(500).send({ success: false, error: 'Failed to submit application' });
    }

    return reply.code(201).send({ success: true, data: application });
  });

  // Employee views their own application
  fastify.get('/m1/applications/mine', {
    preHandler: fastify.requireRole('employee'),
  }, async (request, reply) => {
    const payload = request.jwtPayload;

    const { data, error } = await fastify.db
      .from('applications')
      .select('id, reference_number, status, place_of_work, contact_number, rental_term, submitted_at, phone_models(model_name, retail_price, upfront_amount, rental_amount_7m, rental_amount_13m)')
      .eq('employee_number_hash', payload.employee_number_hash!)
      .not('status', 'in', '("superseded")')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return reply.code(500).send({ success: false, error: 'Failed to fetch application' });
    }

    return reply.send({ success: true, data: data ?? null });
  });

  // Employee cancels their application
  fastify.delete('/m1/applications/mine', {
    preHandler: fastify.requireRole('employee'),
  }, async (request, reply) => {
    const payload = request.jwtPayload;

    const { data: batch } = await fastify.db
      .from('batches')
      .select('id, cutoff_at')
      .eq('status', 'open')
      .single();

    if (!batch || new Date() > new Date(batch.cutoff_at)) {
      return reply.code(400).send({ success: false, error: 'Cancellation period has ended. Contact your manager.' });
    }

    const { error } = await fastify.db
      .from('applications')
      .update({ status: 'cancelled_by_employee', cancelled_at: new Date().toISOString() })
      .eq('employee_number_hash', payload.employee_number_hash!)
      .eq('batch_id', batch.id)
      .eq('status', 'pending');

    if (error) {
      return reply.code(500).send({ success: false, error: 'Failed to cancel application' });
    }

    return reply.send({ success: true });
  });

  // Admin — list all applications for current or specified batch
  fastify.get('/m1/applications', {
    preHandler: fastify.requireRole('m1_admin', 'super_admin'),
  }, async (request, reply) => {
    const { batch_id, status } = request.query as { batch_id?: string; status?: string };

    let query = fastify.db
      .from('applications')
      .select('id, reference_number, display_name, place_of_work, rental_term, status, submitted_at, phone_models(model_name)')
      .order('submitted_at', { ascending: false });

    if (batch_id) query = query.eq('batch_id', batch_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return reply.code(500).send({ success: false, error: 'Failed to fetch applications' });

    return reply.send({ success: true, data });
  });
};

export default applicationsRoute;
