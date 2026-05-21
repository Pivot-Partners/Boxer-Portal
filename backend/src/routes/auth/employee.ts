import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hashValue } from '../../services/auth/hashService';
import { issueEmployeeToken, issueStoreManagerToken } from '../../services/auth/jwtService';
import crypto from 'crypto';

const schema = z.object({
  employee_number: z.string().min(1).max(20),
  id_number: z.string().min(1).max(20),
});

const employeeAuthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/employee', async (request, reply) => {
    const body = schema.safeParse(request.body);
    if (!body.success) {
      return reply.code(422).send({ success: false, error: 'Invalid input', details: body.error.flatten() });
    }

    const { employee_number, id_number } = body.data;
    const empHash = await hashValue(employee_number);
    const idHash = await hashValue(id_number);

    // Check whitelist_records
    const { data: whitelist } = await fastify.db
      .from('whitelist_records')
      .select('id, employee_number_hash, id_number_hash, display_name, place_of_work, store_code, salary_band, eligible_model_ids')
      .eq('is_current', true);

    // bcrypt comparison must happen in-process (can't use SQL for bcrypt)
    const bcrypt = await import('bcryptjs');

    let matchedEmployee = null;
    if (whitelist) {
      for (const record of whitelist) {
        const empMatch = await bcrypt.compare(employee_number.trim().toLowerCase(), record.employee_number_hash);
        if (!empMatch) continue;
        const idMatch = await bcrypt.compare(id_number.trim().toLowerCase(), record.id_number_hash);
        if (idMatch) {
          matchedEmployee = record;
          break;
        }
      }
    }

    if (matchedEmployee) {
      const sessionId = crypto.randomUUID();
      const token = issueEmployeeToken({
        sub: sessionId,
        type: 'employee',
        role: 'employee',
        employee_number_hash: matchedEmployee.employee_number_hash,
        display_name: matchedEmployee.display_name,
        place_of_work: matchedEmployee.place_of_work ?? undefined,
        store_code: matchedEmployee.store_code ?? undefined,
        salary_band: matchedEmployee.salary_band,
        eligible_model_ids: matchedEmployee.eligible_model_ids ?? [],
      });

      await fastify.db.from('sessions').insert({
        id: sessionId,
        session_type: 'employee',
        employee_number_hash: matchedEmployee.employee_number_hash,
        role_name: 'employee',
        store_code: matchedEmployee.store_code,
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
          display_name: matchedEmployee.display_name,
          place_of_work: matchedEmployee.place_of_work,
          store_code: matchedEmployee.store_code,
          eligible_model_ids: matchedEmployee.eligible_model_ids ?? [],
        },
      });
    }

    // Check store_managers
    const { data: storeManagers } = await fastify.db
      .from('store_managers')
      .select('id, employee_number_hash, id_number_hash, display_name, store_code, store_name')
      .eq('is_current', true);

    let matchedManager = null;
    if (storeManagers) {
      for (const record of storeManagers) {
        const empMatch = await bcrypt.compare(employee_number.trim().toLowerCase(), record.employee_number_hash);
        if (!empMatch) continue;
        const idMatch = await bcrypt.compare(id_number.trim().toLowerCase(), record.id_number_hash);
        if (idMatch) {
          matchedManager = record;
          break;
        }
      }
    }

    if (matchedManager) {
      const sessionId = crypto.randomUUID();
      const token = issueStoreManagerToken({
        sub: sessionId,
        type: 'store_manager',
        role: 'store_manager',
        employee_number_hash: matchedManager.employee_number_hash,
        display_name: matchedManager.display_name,
        store_code: matchedManager.store_code,
      });

      await fastify.db.from('sessions').insert({
        id: sessionId,
        session_type: 'store_manager',
        employee_number_hash: matchedManager.employee_number_hash,
        role_name: 'store_manager',
        store_code: matchedManager.store_code,
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
          display_name: matchedManager.display_name,
          store_code: matchedManager.store_code,
          store_name: matchedManager.store_name,
        },
      });
    }

    return reply.code(401).send({ success: false, error: 'Employee number or ID number not recognised' });
  });
};

export default employeeAuthRoute;
