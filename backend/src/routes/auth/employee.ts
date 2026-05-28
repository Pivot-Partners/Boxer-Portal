import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hmacHash, hmacCompare } from '../../services/auth/hashService';
import { issueEmployeeToken, issueStoreManagerToken } from '../../services/auth/jwtService';
import crypto from 'crypto';

const schema = z.object({
	employee_number: z.string().min(1).max(20),
	id_number: z.string().min(1).max(20),
});

const employeeAuthRoute: FastifyPluginAsync = async (fastify) => {
	fastify.post('/auth/employee', {
		config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
	}, async (request, reply) => {
		const body = schema.safeParse(request.body);
		if (!body.success) {
			return reply.code(422).send({ success: false, error: 'Invalid input', details: body.error.flatten() });
		}

		const { employee_number, id_number } = body.data;
		const empHash = hmacHash(employee_number);

		// Single indexed lookup — O(1) instead of full-table bcrypt scan
		const { data: whitelistRecord } = await fastify.db
			.from('whitelist_records')
			.select('id, employee_number_hash, id_number_hash, display_name, place_of_work, store_code, salary_band, eligible_model_ids')
			.eq('employee_number_hash', empHash)
			.eq('is_current', true)
			.single();

		if (whitelistRecord && hmacCompare(id_number, whitelistRecord.id_number_hash)) {
			const sessionId = crypto.randomUUID();
			const token = issueEmployeeToken({
				sub: sessionId,
				type: 'employee',
				role: 'employee',
				employee_number_hash: whitelistRecord.employee_number_hash,
				display_name: whitelistRecord.display_name,
				place_of_work: whitelistRecord.place_of_work ?? undefined,
				store_code: whitelistRecord.store_code ?? undefined,
				salary_band: whitelistRecord.salary_band,
				eligible_model_ids: whitelistRecord.eligible_model_ids ?? [],
			});

			await fastify.db.from('sessions').insert({
				id: sessionId,
				session_type: 'employee',
				employee_number_hash: whitelistRecord.employee_number_hash,
				role_name: 'employee',
				store_code: whitelistRecord.store_code,
				token_hash: crypto.createHash('sha256').update(token).digest('hex'),
				expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
				ip_address: request.ip,
			});

			reply.setCookie('token', token, {
				httpOnly: true,
				sameSite: 'strict',
				secure: process.env.NODE_ENV === 'production',
				path: '/',
				maxAge: 4 * 60 * 60,
			});

			return reply.send({
				success: true,
				data: {
					role: 'employee',
					display_name: whitelistRecord.display_name,
					place_of_work: whitelistRecord.place_of_work,
					store_code: whitelistRecord.store_code,
					eligible_model_ids: whitelistRecord.eligible_model_ids ?? [],
				},
			});
		}

		// Check store_managers
		const { data: storeManagerRecord } = await fastify.db
			.from('store_managers')
			.select('id, employee_number_hash, id_number_hash, display_name, store_code, store_name')
			.eq('employee_number_hash', empHash)
			.eq('is_current', true)
			.single();

		if (storeManagerRecord && hmacCompare(id_number, storeManagerRecord.id_number_hash)) {
			const sessionId = crypto.randomUUID();
			const token = issueStoreManagerToken({
				sub: sessionId,
				type: 'store_manager',
				role: 'store_manager',
				employee_number_hash: storeManagerRecord.employee_number_hash,
				display_name: storeManagerRecord.display_name,
				store_code: storeManagerRecord.store_code,
			});

			await fastify.db.from('sessions').insert({
				id: sessionId,
				session_type: 'store_manager',
				employee_number_hash: storeManagerRecord.employee_number_hash,
				role_name: 'store_manager',
				store_code: storeManagerRecord.store_code,
				token_hash: crypto.createHash('sha256').update(token).digest('hex'),
				expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
				ip_address: request.ip,
			});

			reply.setCookie('token', token, {
				httpOnly: true,
				sameSite: 'strict',
				secure: process.env.NODE_ENV === 'production',
				path: '/',
				maxAge: 8 * 60 * 60,
			});

			return reply.send({
				success: true,
				data: {
					role: 'store_manager',
					display_name: storeManagerRecord.display_name,
					store_code: storeManagerRecord.store_code,
					store_name: storeManagerRecord.store_name,
				},
			});
		}

		return reply.code(401).send({ success: false, error: 'Employee number or ID number not recognised' });
	});
};

export default employeeAuthRoute;
