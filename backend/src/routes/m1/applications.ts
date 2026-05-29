import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { hmacCompare } from '../../services/auth/hashService';
import { encrypt, decrypt } from '../../services/auth/encryptionService';

function safeDecrypt(value: string | null | undefined): string {
	if (!value) return '';
	try { return decrypt(value); } catch { return ''; }
}

async function refreshBatchStats(fastify: FastifyInstance, batchId: string) {
	const { data: apps, error } = await fastify.db
		.from('applications')
		.select('status')
		.eq('batch_id', batchId)
		.neq('status', 'superseded');

	if (error) {
		fastify.log.error(error, 'refreshBatchStats query failed');
		return;
	}

	const total = apps?.length ?? 0;
	const cancelled = apps?.filter((a: any) => a.status?.startsWith('cancelled')).length ?? 0;
	const pending = apps?.filter((a: any) => a.status === 'pending').length ?? 0;

	const { error: updateError } = await fastify.db
		.from('batches')
		.update({ total_applications: total, cancelled_applications: cancelled, pending_applications: pending })
		.eq('id', batchId);

	if (updateError) fastify.log.error(updateError, 'refreshBatchStats update failed');
}

const submitSchema = z.object({
	employee_number: z.string().min(1),
	id_number: z.string().min(1),
	place_of_work_category: z.string().min(1),
	place_of_work: z.string().min(1),
	store_id: z.string().uuid(),
	contact_number: z.string().min(10).max(15),
	email: z.string().email().optional().or(z.literal('')),
	phone_model_id: z.string().uuid(),
	rental_term: z.union([z.literal(7), z.literal(13), z.literal(0)]),
	terms_accepted: z.literal(true),
});

function generateReference(month: Date): string {
	const prefix = `APP-${month.getFullYear()}${String(month.getMonth() + 1).padStart(2, '0')}`;
	const suffix = crypto.randomInt(100000, 999999).toString();
	return `${prefix}-${suffix}`;
}

const BAND_ORDER = ['>3600', '>4400', '>6596', '>8796', '>13595', '>17196'] as const;
const BAND_FLOOR: Record<string, number> = {
	'>3600': 3600, '>4400': 4400, '>6596': 6596,
	'>8796': 8796, '>13595': 13595, '>17196': 17196,
};

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

		// Verify the submitted employee_number matches the authenticated session
		if (!hmacCompare(body.data.employee_number, payload.employee_number_hash!)) {
			return reply.code(400).send({ success: false, error: 'Employee number does not match your account' });
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

		if (new Date() > new Date(batch.cutoff_at)) {
			return reply.code(400).send({ success: false, error: 'The application deadline has passed' });
		}

		// Check active rental (blocks re-application)
		const { data: activeRental } = await fastify.db
			.from('rentals')
			.select('id')
			.eq('employee_number_hash', payload.employee_number_hash!)
			.eq('status', 'active')
			.single();

		if (activeRental) {
			return reply.code(400).send({ success: false, error: 'You already have an active phone rental' });
		}

		// Verify phone model is in employee's eligible list (references phone_models.id)
		if (!payload.eligible_model_ids?.includes(body.data.phone_model_id)) {
			return reply.code(400).send({ success: false, error: 'You are not eligible for this phone model' });
		}

		// Find the batch catalogue entry for the selected phone in the current batch
		const { data: catalogueEntry } = await fastify.db
			.from('batch_phone_catalogue')
			.select('id, model_name, cash_price, upfront_amount, rental_amount_7m, rental_amount_13m, is_available')
			.eq('batch_id', batch.id)
			.eq('source_model_id', body.data.phone_model_id)
			.single();

		if (!catalogueEntry) {
			return reply.code(400).send({ success: false, error: 'This phone is not in the current batch catalogue' });
		}

		if (!catalogueEntry.is_available) {
			return reply.code(400).send({ success: false, error: 'This phone is not available in the current batch' });
		}

		// Pull first_name, last_name, email from whitelist record
		const { data: whitelistRecord } = await fastify.db
			.from('whitelist_records')
			.select('first_name, last_name, email')
			.eq('employee_number_hash', payload.employee_number_hash!)
			.eq('is_current', true)
			.single();

		// Block if a pending application already exists for this employee in this batch
		const { data: existing } = await fastify.db
			.from('applications')
			.select('id')
			.eq('employee_number_hash', payload.employee_number_hash!)
			.eq('batch_id', batch.id)
			.eq('status', 'pending')
			.maybeSingle();

		if (existing) {
			return reply.code(409).send({ success: false, error: 'You already have a pending application. Cancel it first if you wish to reapply.' });
		}

		const now = new Date().toISOString();
		const newId = crypto.randomUUID();

		const { data: store } = await fastify.db
			.from('stores')
			.select('name')
			.eq('id', body.data.store_id)
			.single();

		// Encrypt PII — raw values never written to logs
		const employeeNumberEncrypted = encrypt(body.data.employee_number.trim());
		const idNumberEncrypted = encrypt(body.data.id_number.trim());

		const { data: application, error } = await fastify.db
			.from('applications')
			.insert({
				id: newId,
				reference_number: generateReference(new Date()),
				employee_number_hash: payload.employee_number_hash,
				display_name: payload.display_name,
				first_name: whitelistRecord?.first_name ?? null,
				last_name: whitelistRecord?.last_name ?? null,
				email: body.data.email || whitelistRecord?.email || null,
				employee_number_encrypted: employeeNumberEncrypted,
				id_number_encrypted: idNumberEncrypted,
				place_of_work: store?.name ?? body.data.place_of_work,
				store_id: body.data.store_id,
				contact_number: body.data.contact_number,
				phone_model_id: body.data.phone_model_id,
				batch_catalogue_id: catalogueEntry.id,
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

		await refreshBatchStats(fastify, batch.id);
		return reply.code(201).send({ success: true, data: application });
	});

	// Employee views their own application
	fastify.get('/m1/applications/mine', {
		preHandler: fastify.requireRole('employee'),
	}, async (request, reply) => {
		const payload = request.jwtPayload;

		const { data, error } = await fastify.db
			.from('applications')
			.select('id, reference_number, status, place_of_work, contact_number, rental_term, submitted_at, phone_model_id, batch_phone_catalogue(model_name, cash_price, upfront_amount, rental_amount_7m, rental_amount_13m)')
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

	// Employee edits phone selection on their pending application
	fastify.patch('/m1/applications/mine', {
		preHandler: fastify.requireRole('employee'),
	}, async (request, reply) => {
		const payload = request.jwtPayload;

		const body = z.object({
			phone_model_id: z.string().uuid(),
			rental_term: z.union([z.literal(7), z.literal(13), z.literal(0)]),
		}).safeParse(request.body);

		if (!body.success) {
			return reply.code(422).send({ success: false, error: 'Invalid input', details: body.error.flatten() });
		}

		const { data: batch } = await fastify.db
			.from('batches')
			.select('id, status, cutoff_at')
			.eq('status', 'open')
			.single();

		if (!batch) {
			return reply.code(400).send({ success: false, error: 'Applications are not currently open' });
		}

		if (new Date() > new Date(batch.cutoff_at)) {
			return reply.code(400).send({ success: false, error: 'The application deadline has passed' });
		}

		const { data: existing } = await fastify.db
			.from('applications')
			.select('id')
			.eq('employee_number_hash', payload.employee_number_hash!)
			.eq('batch_id', batch.id)
			.eq('status', 'pending')
			.maybeSingle();

		if (!existing) {
			return reply.code(404).send({ success: false, error: 'No pending application found to edit' });
		}

		if (!payload.eligible_model_ids?.includes(body.data.phone_model_id)) {
			return reply.code(400).send({ success: false, error: 'You are not eligible for this phone model' });
		}

		const { data: catalogueEntry } = await fastify.db
			.from('batch_phone_catalogue')
			.select('id, is_available')
			.eq('batch_id', batch.id)
			.eq('source_model_id', body.data.phone_model_id)
			.single();

		if (!catalogueEntry) {
			return reply.code(400).send({ success: false, error: 'This phone is not in the current batch catalogue' });
		}

		if (!catalogueEntry.is_available) {
			return reply.code(400).send({ success: false, error: 'This phone is not available in the current batch' });
		}

		const { error: updateError } = await fastify.db
			.from('applications')
			.update({
				phone_model_id: body.data.phone_model_id,
				batch_catalogue_id: catalogueEntry.id,
				rental_term: body.data.rental_term,
			})
			.eq('id', existing.id);

		if (updateError) {
			fastify.log.error(updateError);
			return reply.code(500).send({ success: false, error: 'Failed to update application' });
		}

		const { data: updated, error: fetchError } = await fastify.db
			.from('applications')
			.select('id, reference_number, status, place_of_work, contact_number, rental_term, submitted_at, phone_model_id, batch_phone_catalogue(model_name, cash_price, upfront_amount, rental_amount_7m, rental_amount_13m)')
			.eq('id', existing.id)
			.single();

		if (fetchError) {
			return reply.code(500).send({ success: false, error: 'Failed to fetch updated application' });
		}

		return reply.send({ success: true, data: updated });
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

		await refreshBatchStats(fastify, batch.id);
		return reply.send({ success: true });
	});

	// Admin — list all applications (table view, no PII decryption)
	fastify.get('/m1/applications', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { batch_id, status, page: pageStr, page_size: pageSizeStr, search, sort_by, sort_dir } = request.query as { batch_id?: string; status?: string; page?: string; page_size?: string; search?: string; sort_by?: string; sort_dir?: string };

		const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
		const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeStr ?? '50', 10) || 50));
		const from = (page - 1) * pageSize;
		const to = from + pageSize - 1;

		const SORTABLE = ['submitted_at', 'reference_number', 'display_name', 'place_of_work', 'status', 'rental_term'];
		const sortCol = SORTABLE.includes(sort_by ?? '') ? sort_by! : 'submitted_at';
		const ascending = sort_dir === 'asc';

		let query = fastify.db
			.from('applications')
			.select('id, reference_number, first_name, last_name, display_name, place_of_work, rental_term, status, batch_id, submitted_at, admin_edited_at, admin_editor_name, batch_phone_catalogue(model_name)', { count: 'exact' })
			.not('status', 'in', '("superseded")')
			.order(sortCol, { ascending })
			.range(from, to);

		if (batch_id) query = query.eq('batch_id', batch_id);
		if (status) query = query.eq('status', status);
		if (search?.trim()) {
			const term = search.trim();
			query = query.or(`reference_number.ilike.%${term}%,display_name.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,place_of_work.ilike.%${term}%`);
		}

		const { data, error, count } = await query;
		if (error) return reply.code(500).send({ success: false, error: 'Failed to fetch applications', details: error.message });

		return reply.send({ success: true, data, total: count ?? 0, page, page_size: pageSize });
	});

	// Admin — single application with decrypted PII (for detail/edit panel)
	fastify.get('/m1/applications/:id', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { id } = request.params as { id: string };

		const { data, error } = await fastify.db
			.from('applications')
			.select('id, reference_number, first_name, last_name, display_name, place_of_work, contact_number, email, phone_model_id, batch_catalogue_id, rental_term, status, batch_id, submitted_at, employee_number_hash, employee_number_encrypted, id_number_encrypted, admin_edited_at, admin_editor_name, admin_edit_notes, batch_phone_catalogue(id, model_name, cash_price, upfront_amount, rental_amount_7m, rental_amount_13m)')
			.eq('id', id)
			.single();

		if (error || !data) {
			return reply.code(404).send({ success: false, error: 'Application not found' });
		}

		// Look up salary band and compute eligible phone model IDs.
		// Use limit(1) array form — maybeSingle() returns null on multiple rows
		// (e.g. if is_current flip had a race) which would silently fail the lookup.
		let salary_band: string | null = null;
		let eligible_model_ids: string[] = [];
		let whitelist_found = false;

		const { data: wlRows } = await fastify.db
			.from('whitelist_records')
			.select('salary_band')
			.eq('employee_number_hash', (data as any).employee_number_hash)
			.eq('is_current', true)
			.limit(1);

		const wlRecord = wlRows?.[0] ?? null;
		whitelist_found = wlRecord !== null;

		if (wlRecord) {
			salary_band = wlRecord.salary_band ?? null;
			if (salary_band) {
				const empBandIdx = BAND_ORDER.indexOf(salary_band as typeof BAND_ORDER[number]);
				if (empBandIdx >= 0) {
					const { data: phoneModels } = await fastify.db
						.from('phone_models')
						.select('id, min_salary_band')
						.eq('is_active', true);
					eligible_model_ids = (phoneModels ?? [])
						.filter((m: any) => {
							const phoneBandIdx = BAND_ORDER.indexOf(m.min_salary_band);
							return phoneBandIdx >= 0 && empBandIdx >= phoneBandIdx;
						})
						.map((m: any) => m.id);
				}
			}
		}

		const result = {
			...(data as any),
			employee_number: safeDecrypt((data as any).employee_number_encrypted),
			id_number: safeDecrypt((data as any).id_number_encrypted),
			employee_number_encrypted: undefined,
			id_number_encrypted: undefined,
			employee_number_hash: undefined,
			salary_band,
			eligible_model_ids,
			whitelist_found,
		};

		return reply.send({ success: true, data: result });
	});

	// Admin — edit an application
	fastify.patch('/m1/applications/:id', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { id } = request.params as { id: string };
		const payload = request.jwtPayload;

		const body = z.object({
			first_name: z.string().optional(),
			last_name: z.string().optional(),
			contact_number: z.string().min(10).max(15).optional(),
			email: z.string().email().or(z.literal('')).optional(),
			place_of_work: z.string().optional(),
			phone_model_id: z.string().uuid().optional(),
			rental_term: z.union([z.literal(7), z.literal(13), z.literal(0)]).optional(),
			status: z.enum(['pending', 'validated', 'converted_to_order', 'cancelled_by_employee', 'cancelled_no_whitelist', 'cancelled_no_stock', 'rejected']).optional(),
			admin_edit_notes: z.string().optional(),
		}).safeParse(request.body);

		if (!body.success) {
			return reply.code(422).send({ success: false, error: 'Invalid input', details: body.error.flatten() });
		}

		const { data: existing, error: fetchError } = await fastify.db
			.from('applications')
			.select('id, batch_id, employee_number_hash, phone_model_id')
			.eq('id', id)
			.single();

		if (fetchError || !existing) {
			return reply.code(404).send({ success: false, error: 'Application not found' });
		}

		// Enforce salary eligibility when changing phone model or switching to cash term
		if (body.data.phone_model_id !== undefined || body.data.rental_term === 0) {
			const { data: wlRecord } = await fastify.db
				.from('whitelist_records')
				.select('salary_band')
				.eq('employee_number_hash', (existing as any).employee_number_hash)
				.eq('is_current', true)
				.maybeSingle();

			if (wlRecord?.salary_band) {
				const empBandIdx = BAND_ORDER.indexOf(wlRecord.salary_band as typeof BAND_ORDER[number]);
				const salaryFloor = BAND_FLOOR[wlRecord.salary_band] ?? 0;
				const phoneModelId = body.data.phone_model_id ?? (existing as any).phone_model_id;

				if (phoneModelId) {
					const { data: pm } = await fastify.db
						.from('phone_models')
						.select('min_salary_band, cash_price')
						.eq('id', phoneModelId)
						.single();

					if (pm) {
						if (body.data.phone_model_id !== undefined) {
							const phoneBandIdx = BAND_ORDER.indexOf((pm as any).min_salary_band);
							if (phoneBandIdx === -1 || empBandIdx < phoneBandIdx) {
								return reply.code(400).send({
									success: false,
									error: 'This employee does not meet the salary requirement for this phone model',
								});
							}
						}
						if (body.data.rental_term === 0 && salaryFloor < (pm as any).cash_price * 4) {
							return reply.code(400).send({
								success: false,
								error: "Employee's salary does not qualify for the cash purchase option (25% rule)",
							});
						}
					}
				}
			}
		}

		const editorName = (payload as any).full_name ?? (payload as any).display_name ?? 'Admin';
		const updates: Record<string, unknown> = {
			admin_edited_by: (payload as any).user_id ?? null,
			admin_edited_at: new Date().toISOString(),
			admin_editor_name: editorName,
		};

		if (body.data.first_name !== undefined) updates.first_name = body.data.first_name || null;
		if (body.data.last_name !== undefined) updates.last_name = body.data.last_name || null;
		if (body.data.contact_number !== undefined) updates.contact_number = body.data.contact_number;
		if (body.data.email !== undefined) updates.email = body.data.email || null;
		if (body.data.place_of_work !== undefined) updates.place_of_work = body.data.place_of_work || null;
		if (body.data.admin_edit_notes !== undefined) updates.admin_edit_notes = body.data.admin_edit_notes || null;
		if (body.data.rental_term !== undefined) updates.rental_term = body.data.rental_term;
		if (body.data.status !== undefined) updates.status = body.data.status;

		if (body.data.phone_model_id !== undefined) {
			const { data: catalogueEntry } = await fastify.db
				.from('batch_phone_catalogue')
				.select('id, is_available')
				.eq('batch_id', (existing as any).batch_id)
				.eq('source_model_id', body.data.phone_model_id)
				.single();

			if (!catalogueEntry) {
				return reply.code(400).send({ success: false, error: 'Phone not in this batch catalogue' });
			}
			if (!catalogueEntry.is_available) {
				return reply.code(400).send({ success: false, error: 'Phone is not available in this batch' });
			}

			updates.phone_model_id = body.data.phone_model_id;
			updates.batch_catalogue_id = catalogueEntry.id;
		}

		const { error: updateError } = await fastify.db
			.from('applications')
			.update(updates)
			.eq('id', id);

		if (updateError) {
			fastify.log.error(updateError);
			return reply.code(500).send({ success: false, error: 'Failed to update application' });
		}

		return reply.send({ success: true });
	});
};

export default applicationsRoute;
