import { createClient } from '@supabase/supabase-js';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof createClient>;
  }
}

const databasePlugin: FastifyPluginAsync = async (fastify) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const client = createClient(url, key, {
    auth: { persistSession: false },
  });

  fastify.decorate('db', client);
};

export default fp(databasePlugin, { name: 'database' });
