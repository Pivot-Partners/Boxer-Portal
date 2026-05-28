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
			.select('id, batch_month, cutoff_at, status, total_applications, pending_applications, valid_applications, cancelled_applications, rejected_applications, approved_at, approved_by')
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

		const batchId = crypto.randomUUID();

		const { data, error } = await fastify.db
			.from('batches')
			.insert({
				id: batchId,
				batch_month,
				cutoff_at,
				status: 'open',
			})
			.select()
			.single();

		if (error) {
			fastify.log.error(error, 'Failed to create batch');
			return reply.code(500).send({ success: false, error: 'Failed to create batch' });
		}

		// Snapshot active phone_models into batch_phone_catalogue, locking prices for this batch
		const { data: models, error: modelsError } = await fastify.db
			.from('phone_models')
			.select('id, model_name, model_code, cash_price, upfront_amount, rental_amount_7m, rental_amount_13m, display_order')
			.eq('is_active', true)
			.order('display_order');

		if (modelsError) {
			fastify.log.error(modelsError, 'Failed to fetch phone models for batch catalogue');
		} else if (models && models.length > 0) {
			const catalogueRows = models.map((m: any) => ({
				batch_id: batchId,
				source_model_id: m.id,
				model_name: m.model_name,
				model_code: m.model_code ?? null,
				cash_price: m.cash_price,
				upfront_amount: m.upfront_amount,
				rental_amount_7m: m.rental_amount_7m,
				rental_amount_13m: m.rental_amount_13m,
				display_order: m.display_order,
				is_available: true,
			}));

			const { error: catalogueError } = await fastify.db
				.from('batch_phone_catalogue')
				.insert(catalogueRows);

			if (catalogueError) {
				fastify.log.error(catalogueError, 'Failed to seed batch phone catalogue');
			} else {
				fastify.log.info({ batchId, modelCount: models.length }, 'Batch phone catalogue seeded');
			}
		}

		return reply.code(201).send({ success: true, data });
	});

	// Admin — get phone catalogue for a specific batch
	fastify.get('/m1/batches/:id/catalogue', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { id } = request.params as { id: string };

		const { data, error } = await fastify.db
			.from('batch_phone_catalogue')
			.select('*')
			.eq('batch_id', id)
			.order('display_order');

		if (error) return reply.code(500).send({ success: false, error: 'Failed to fetch catalogue', details: error.message });
		return reply.send({ success: true, data });
	});

	// Admin — seed (or re-seed) catalogue from current active phone_models
	// Use this for batches opened before the catalogue feature existed.
	fastify.post('/m1/batches/:id/catalogue/seed', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { id } = request.params as { id: string };

		const { data: batch } = await fastify.db
			.from('batches')
			.select('id, status')
			.eq('id', id)
			.single();

		if (!batch) return reply.code(404).send({ success: false, error: 'Batch not found' });

		const { data: models, error: modelsError } = await fastify.db
			.from('phone_models')
			.select('id, model_name, model_code, cash_price, upfront_amount, rental_amount_7m, rental_amount_13m, display_order')
			.eq('is_active', true)
			.order('display_order');

		if (modelsError || !models?.length) {
			return reply.code(400).send({ success: false, error: 'No active phone models found to seed from' });
		}

		// Delete any existing entries for this batch then re-insert
		await fastify.db.from('batch_phone_catalogue').delete().eq('batch_id', id);

		const catalogueRows = models.map((m: any) => ({
			batch_id: id,
			source_model_id: m.id,
			model_name: m.model_name,
			model_code: m.model_code ?? null,
			cash_price: m.cash_price,
			upfront_amount: m.upfront_amount,
			rental_amount_7m: m.rental_amount_7m,
			rental_amount_13m: m.rental_amount_13m,
			display_order: m.display_order,
			is_available: true,
		}));

		const { error } = await fastify.db.from('batch_phone_catalogue').insert(catalogueRows);
		if (error) {
			fastify.log.error(error, 'Failed to seed batch catalogue');
			return reply.code(500).send({ success: false, error: 'Failed to seed catalogue', details: error.message });
		}

		fastify.log.info({ batchId: id, seeded: models.length }, 'Batch catalogue seeded via admin');
		return reply.send({ success: true, data: { seeded: models.length } });
	});

	// Admin — toggle a model's availability in a specific batch catalogue
	fastify.patch('/m1/batches/:id/catalogue/:catalogueId', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { id, catalogueId } = request.params as { id: string; catalogueId: string };
		const { is_available } = request.body as { is_available: boolean };

		const { data, error } = await fastify.db
			.from('batch_phone_catalogue')
			.update({ is_available })
			.eq('id', catalogueId)
			.eq('batch_id', id)
			.select()
			.single();

		if (error) return reply.code(500).send({ success: false, error: 'Failed to update catalogue entry' });
		return reply.send({ success: true, data });
	});

	// Admin — close an open batch manually
	fastify.post('/m1/batches/:id/close', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { id } = request.params as { id: string };

		const { data: batch, error: fetchError } = await fastify.db
			.from('batches')
			.select('id, status')
			.eq('id', id)
			.single();

		if (fetchError || !batch) return reply.code(404).send({ success: false, error: 'Batch not found' });
		if (batch.status !== 'open') return reply.code(400).send({ success: false, error: `Batch is already ${batch.status}` });

		await fastify.db.from('batches').update({ status: 'awaiting_approval' }).eq('id', id);
		return reply.send({ success: true });
	});

	// Admin — approve batch (status must be awaiting_approval)
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

		// Promote pending applications to converted_to_order
		await fastify.db
			.from('applications')
			.update({ status: 'converted_to_order' })
			.eq('batch_id', id)
			.eq('status', 'pending');

		return reply.send({ success: true, message: 'Batch approved. Download the HR export from /m1/batches/:id/export' });
	});
};

export default batchRoute;
