import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const adminUsersRoute: FastifyPluginAsync = async (fastify) => {
	fastify.get('/admin/users', {
		preHandler: fastify.requireRole('super_admin'),
	}, async (request, reply) => {
		const { data, error } = await fastify.db
			.from('users')
			.select('id, email, full_name, is_active, created_at, last_login_at, roles(name)')
			.order('created_at', { ascending: false });

		if (error) return reply.code(500).send({ success: false, error: 'Failed to fetch users' });
		return reply.send({ success: true, data });
	});

	fastify.post('/admin/users', {
		preHandler: fastify.requireRole('super_admin'),
	}, async (request, reply) => {
		const body = z.object({
			email: z.string().email(),
			full_name: z.string().min(2).max(255),
			password: z.string().min(8).max(100),
			role: z.enum(['super_admin', 'm1_admin', 'm2_admin', 'm2_reviewer']),
		}).safeParse(request.body);

		if (!body.success) return reply.code(422).send({ success: false, error: 'Invalid input', details: body.error.flatten() });

		const { data: role } = await fastify.db
			.from('roles')
			.select('id')
			.eq('name', body.data.role)
			.single();

		if (!role) return reply.code(400).send({ success: false, error: 'Invalid role' });

		const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
		const password_hash = await bcrypt.hash(body.data.password, rounds);

		const { data, error } = await fastify.db
			.from('users')
			.insert({
				email: body.data.email.toLowerCase(),
				full_name: body.data.full_name,
				password_hash,
				role_id: role.id,
				is_active: true,
			})
			.select('id, email, full_name, is_active, created_at')
			.single();

		if (error) {
			if (error.code === '23505') return reply.code(409).send({ success: false, error: 'An account with this email already exists' });
			fastify.log.error(error, 'Failed to create admin user');
			return reply.code(500).send({ success: false, error: 'Failed to create user' });
		}

		return reply.code(201).send({ success: true, data });
	});

	fastify.patch('/admin/users/:id', {
		preHandler: fastify.requireRole('super_admin'),
	}, async (request, reply) => {
		const { id } = request.params as { id: string };
		const body = z.object({
			is_active: z.boolean().optional(),
			full_name: z.string().min(2).max(255).optional(),
			new_password: z.string().min(8).max(100).optional(),
		}).safeParse(request.body);

		if (!body.success) return reply.code(422).send({ success: false, error: 'Invalid input' });

		const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
		if (body.data.is_active !== undefined) updates.is_active = body.data.is_active;
		if (body.data.full_name) updates.full_name = body.data.full_name;
		if (body.data.new_password) {
			const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);
			updates.password_hash = await bcrypt.hash(body.data.new_password, rounds);
			updates.failed_login_attempts = 0;
			updates.locked_until = null;
		}

		const { data, error } = await fastify.db
			.from('users')
			.update(updates)
			.eq('id', id)
			.select('id, email, full_name, is_active, created_at, last_login_at')
			.single();

		if (error || !data) return reply.code(404).send({ success: false, error: 'User not found' });
		return reply.send({ success: true, data });
	});
};

export default adminUsersRoute;
