import 'dotenv/config';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import databasePlugin from './plugins/database';
import authPlugin from './plugins/auth';
import employeeAuthRoute from './routes/auth/employee';
import adminAuthRoute from './routes/auth/admin';
import logoutRoute from './routes/auth/logout';
import meRoute from './routes/auth/me';
import refreshRoute from './routes/auth/refresh';
import storesRoute from './routes/m1/stores';
import storeCategoriesRoute from './routes/m1/storeCategories';
import phoneModelsRoute from './routes/m1/phoneModels';
import applicationsRoute from './routes/m1/applications';
import whitelistRoute from './routes/m1/whitelist';
import batchRoute from './routes/m1/batches';
import exportRoute from './routes/m1/export';
import configRoute from './routes/admin/config';
import adminUsersRoute from './routes/admin/users';
import m1ConfigRoute from './routes/m1/m1Config';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  trustProxy: true,
});

async function start() {
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  await fastify.register(cookie);
  await fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB — HR CSVs can be ~18k rows × 2 files
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await fastify.register(databasePlugin);
  await fastify.register(authPlugin);

  // Routes under /v1 prefix
  await fastify.register(async (v1) => {
    await v1.register(employeeAuthRoute);
    await v1.register(adminAuthRoute);
    await v1.register(logoutRoute);
    await v1.register(meRoute);
    await v1.register(refreshRoute);
    await v1.register(storesRoute);
    await v1.register(storeCategoriesRoute);
    await v1.register(phoneModelsRoute);
    await v1.register(applicationsRoute);
    await v1.register(whitelistRoute);
    await v1.register(batchRoute);
    await v1.register(exportRoute);
    await v1.register(configRoute);
    await v1.register(adminUsersRoute);
    await v1.register(m1ConfigRoute);
  }, { prefix: '/v1' });

  fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  fastify.log.info(`Server running on port ${port}`);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
