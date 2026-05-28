import type { FastifyPluginAsync } from 'fastify';
import { parse } from 'csv-parse/sync';
import { hmacHash } from '../../services/auth/hashService';

const SALARY_BANDS = ['>3600', '>4400', '>6596', '>8796', '>13595', '>17196'] as const;
type SalaryBand = typeof SALARY_BANDS[number];

function getHighestBand(row: Record<string, string>): SalaryBand | null {
	for (let i = SALARY_BANDS.length - 1; i >= 0; i--) {
		if (row[SALARY_BANDS[i]!]?.trim().toUpperCase() === 'TRUE') {
			return SALARY_BANDS[i]!;
		}
	}
	return null;
}

const PHONE_ELIGIBILITY: Record<SalaryBand, SalaryBand[]> = {
	'>3600': ['>3600'],
	'>4400': ['>3600', '>4400'],
	'>6596': ['>3600', '>4400', '>6596'],
	'>8796': ['>3600', '>4400', '>6596', '>8796'],
	'>13595': ['>3600', '>4400', '>6596', '>8796', '>13595'],
	'>17196': ['>3600', '>4400', '>6596', '>8796', '>13595', '>17196'],
};

const whitelistRoute: FastifyPluginAsync = async (fastify) => {
	fastify.post('/m1/whitelist/upload', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const fileList: Array<{ filename: string; buffer: Buffer }> = [];

		for await (const part of request.files()) {
			const buffer = await part.toBuffer();
			if (buffer.length > 0) {
				fileList.push({ filename: part.filename, buffer });
			}
		}

		if (fileList.length === 0) {
			return reply.code(400).send({ success: false, error: 'No file provided' });
		}

		// Parse all files before touching DB — fail fast on any bad CSV
		const allRows: Record<string, string>[] = [];
		for (const { filename, buffer } of fileList) {
			const csvText = buffer.toString('utf-8');
			let rows: Record<string, string>[];
			try {
				rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
			} catch {
				return reply.code(400).send({ success: false, error: `Could not parse CSV: ${filename}` });
			}
			allRows.push(...rows);
		}

		const uploadId = crypto.randomUUID();

		// Upload files to storage under a shared folder
		for (let i = 0; i < fileList.length; i++) {
			const storagePath = `whitelist-uploads/${uploadId}/${i}-${fileList[i]!.filename}`;
			await fastify.db.storage.from('whitelist-uploads').upload(storagePath, fileList[i]!.buffer);
		}

		const combinedFileName = fileList.length === 1
			? fileList[0]!.filename
			: fileList.map(f => f.filename).join(', ');

		await fastify.db.from('whitelist_uploads').insert({
			id: uploadId,
			file_name: combinedFileName.length <= 255 ? combinedFileName : `${fileList.length} files`,
			storage_path: `whitelist-uploads/${uploadId}/`,
			uploaded_by: request.jwtPayload.user_id,
			record_count: allRows.length,
			status: 'processing',
		});

		// Flip is_current exactly once — after all files parsed, before inserting new records
		await fastify.db.from('whitelist_records').update({ is_current: false }).eq('is_current', true);

		const { data: phoneModels } = await fastify.db
			.from('phone_models')
			.select('id, model_name, min_salary_band')
			.eq('is_active', true);

		let validCount = 0;
		let errorCount = 0;
		const records = [];

		for (const row of allRows) {
			const empNo = row['EmployeeNo']?.trim();
			const idNo = row['Identity Number']?.trim();
			const firstName = row['First names']?.trim();
			const lastName = row['Last name']?.trim();
			// Permanent CSV uses "Store Num", flexi CSV uses "Store Number"
			const storeNumber = (row['Store Number'] ?? row['Store Num'])?.trim();
			const category = row['Category']?.trim();
			const placeOfWork = row['Pers. subarea text']?.trim() || null;

			if (!empNo || !idNo) {
				errorCount++;
				continue;
			}

			const salaryBand = getHighestBand(row);
			const eligibleModelIds = salaryBand
				? (phoneModels ?? [])
					.filter((m: any) => PHONE_ELIGIBILITY[salaryBand].includes(m.min_salary_band))
					.map((m: any) => m.id)
				: [];

			records.push({
				upload_id: uploadId,
				employee_number_hash: hmacHash(empNo),
				id_number_hash: hmacHash(idNo),
				display_name: [firstName, lastName].filter(Boolean).join(' ') || empNo,
				first_name: firstName || null,
				last_name: lastName || null,
				store_code: storeNumber && storeNumber !== '#N/A' ? storeNumber : null,
				place_of_work: placeOfWork,
				employment_type: category?.toLowerCase() === 'permanent' ? 'permanent' : 'flexi',
				salary_band: salaryBand ?? null,
				eligible_model_ids: eligibleModelIds,
				is_current: true,
			});
			validCount++;
		}

		for (let i = 0; i < records.length; i += 100) {
			await fastify.db.from('whitelist_records').insert(records.slice(i, i + 100));
		}

		await fastify.db.from('whitelist_uploads').update({
			status: 'active',
			valid_count: validCount,
			error_count: errorCount,
		}).eq('id', uploadId);

		return reply.send({
			success: true,
			data: {
				upload_id: uploadId,
				files: fileList.length,
				record_count: allRows.length,
				valid_count: validCount,
				error_count: errorCount,
			},
		});
	});

	fastify.get('/m1/whitelist/uploads', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { data, error } = await fastify.db
			.from('whitelist_uploads')
			.select('id, file_name, uploaded_at, record_count, valid_count, error_count, status')
			.order('uploaded_at', { ascending: false })
			.limit(10);

		if (error) return reply.code(500).send({ success: false, error: 'Failed to fetch uploads' });
		return reply.send({ success: true, data });
	});
};

export default whitelistRoute;
