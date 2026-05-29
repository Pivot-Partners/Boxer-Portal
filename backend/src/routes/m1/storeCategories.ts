import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const storeCategoriesRoute: FastifyPluginAsync = async (fastify) => {
	// Public — used by the employee apply form and admin UI
	fastify.get('/m1/store-categories', async (_request, reply) => {
		const { data, error } = await fastify.db
			.from('store_categories')
			.select('key, label, is_single_store, display_order, is_active')
			.order('display_order');
		if (error) {
			fastify.log.error(error);
			return reply.code(500).send({ success: false, error: 'Failed to fetch categories' });
		}
		return reply.send({ success: true, data: data ?? [] });
	});

	// Admin — create a new category
	fastify.post('/m1/store-categories', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const body = z.object({
			key: z
				.string()
				.min(1)
				.max(50)
				.regex(/^[a-z0-9_]+$/, 'Key must be lowercase letters, numbers, and underscores only')
				.trim(),
			label: z.string().min(1).max(255).trim(),
			is_single_store: z.boolean().default(false),
			display_order: z.number().int().optional(),
		}).safeParse(request.body);

		if (!body.success) {
			return reply.code(422).send({ success: false, error: 'Invalid input', details: body.error.flatten() });
		}

		const { data: existing } = await fastify.db
			.from('store_categories')
			.select('key')
			.eq('key', body.data.key)
			.maybeSingle();

		if (existing) {
			return reply.code(409).send({ success: false, error: 'A category with this key already exists' });
		}

		let displayOrder = body.data.display_order;
		if (displayOrder === undefined) {
			const { data: maxRow } = await fastify.db
				.from('store_categories')
				.select('display_order')
				.order('display_order', { ascending: false })
				.limit(1)
				.maybeSingle();
			displayOrder = ((maxRow as any)?.display_order ?? 0) + 1;
		}

		const { data, error } = await fastify.db
			.from('store_categories')
			.insert({
				key: body.data.key,
				label: body.data.label,
				is_single_store: body.data.is_single_store,
				display_order: displayOrder,
				is_active: true,
			})
			.select()
			.single();

		if (error) {
			fastify.log.error(error);
			return reply.code(500).send({ success: false, error: 'Failed to create category' });
		}

		return reply.code(201).send({ success: true, data });
	});

	// Admin — update a category (label, is_single_store, display_order, is_active)
	// Key is intentionally immutable: stores reference it as a plain string.
	fastify.patch('/m1/store-categories/:key', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { key } = request.params as { key: string };

		const body = z.object({
			label: z.string().min(1).max(255).trim().optional(),
			is_single_store: z.boolean().optional(),
			display_order: z.number().int().optional(),
			is_active: z.boolean().optional(),
		}).safeParse(request.body);

		if (!body.success) {
			return reply.code(422).send({ success: false, error: 'Invalid input' });
		}

		const updates = body.data;
		if (Object.keys(updates).length === 0) {
			return reply.code(422).send({ success: false, error: 'Nothing to update' });
		}

		const { data, error } = await fastify.db
			.from('store_categories')
			.update(updates)
			.eq('key', key)
			.select()
			.single();

		if (error || !data) {
			return reply.code(404).send({ success: false, error: 'Category not found' });
		}

		return reply.send({ success: true, data });
	});
};

export default storeCategoriesRoute;
