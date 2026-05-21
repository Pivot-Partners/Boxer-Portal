import type { FastifyPluginAsync } from 'fastify';
import { parse } from 'csv-parse/sync';
import { hashValue } from '../../services/auth/hashService';

// Salary band columns in the HR CSV
const SALARY_BANDS = ['>3600', '>4400', '>6596', '>8796', '>13595', '>17196'] as const;
type SalaryBand = typeof SALARY_BANDS[number];

// Highest TRUE salary band for an employee = their effective band
function getHighestBand(row: Record<string, string>): SalaryBand | null {
  for (let i = SALARY_BANDS.length - 1; i >= 0; i--) {
    if (row[SALARY_BANDS[i]!]?.trim().toUpperCase() === 'TRUE') {
      return SALARY_BANDS[i]!;
    }
  }
  return null;
}

// Phone eligibility based on salary band
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
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ success: false, error: 'No file provided' });
    }

    const buffer = await data.toBuffer();
    const csvText = buffer.toString('utf-8');

    let rows: Record<string, string>[];
    try {
      rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
    } catch {
      return reply.code(400).send({ success: false, error: 'Could not parse CSV file' });
    }

    // Upload file to Supabase Storage
    const fileName = `whitelist-${Date.now()}.csv`;
    const storagePath = `whitelist-uploads/${fileName}`;
    await fastify.db.storage.from('whitelist-uploads').upload(storagePath, buffer);

    // Create upload record
    const uploadId = crypto.randomUUID();
    await fastify.db.from('whitelist_uploads').insert({
      id: uploadId,
      file_name: data.filename,
      storage_path: storagePath,
      uploaded_by: request.jwtPayload.user_id,
      record_count: rows.length,
      status: 'processing',
    });

    // Mark all previous records as not current
    await fastify.db.from('whitelist_records').update({ is_current: false }).eq('is_current', true);

    let validCount = 0;
    let errorCount = 0;
    const records = [];

    // Get phone models to map salary bands to model IDs
    const { data: phoneModels } = await fastify.db
      .from('phone_models')
      .select('id, model_name, min_salary_band')
      .eq('is_active', true);

    for (const row of rows) {
      const empNo = row['EmployeeNo']?.trim();
      const idNo = row['Identity Number']?.trim();
      const firstName = row['First names']?.trim();
      const lastName = row['Last name']?.trim();
      const storeNumber = row['Store Number']?.trim();
      const category = row['Category']?.trim();

      if (!empNo || !idNo || !firstName || !lastName) {
        errorCount++;
        continue;
      }

      const salaryBand = getHighestBand(row);
      if (!salaryBand) {
        errorCount++;
        continue;
      }

      const eligibleBands = PHONE_ELIGIBILITY[salaryBand];
      const eligibleModelIds = (phoneModels ?? [])
        .filter((m: any) => eligibleBands.includes(m.min_salary_band))
        .map((m: any) => m.id);

      try {
        const empHash = await hashValue(empNo);
        const idHash = await hashValue(idNo);

        records.push({
          upload_id: uploadId,
          employee_number_hash: empHash,
          id_number_hash: idHash,
          display_name: `${firstName} ${lastName}`,
          store_code: storeNumber && storeNumber !== '#N/A' ? storeNumber : null,
          employment_type: category?.toLowerCase() === 'permanent' ? 'permanent' : 'flexi',
          salary_band: salaryBand,
          eligible_model_ids: eligibleModelIds,
          is_current: true,
        });
        validCount++;
      } catch {
        errorCount++;
      }
    }

    // Batch insert in chunks of 100
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
      data: { upload_id: uploadId, record_count: rows.length, valid_count: validCount, error_count: errorCount },
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
