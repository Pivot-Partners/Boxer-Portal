/**
 * Seeds the initial Super Admin account.
 * Idempotent — will not overwrite an existing super_admin.
 * Run after applying schema: npx tsx scripts/seed-admin.ts
 */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function seed() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_INITIAL_PASSWORD;

  if (!email || !password) {
    console.error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_INITIAL_PASSWORD must be set');
    process.exit(1);
  }

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    console.log('Super admin already exists — skipping');
    return;
  }

  const { data: role } = await db
    .from('roles')
    .select('id')
    .eq('name', 'super_admin')
    .single();

  if (!role) {
    console.error('super_admin role not found — run the schema migration first');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10));

  const { error } = await db.from('users').insert({
    email: email.toLowerCase(),
    password_hash: hash,
    role_id: role.id,
    full_name: 'Super Admin',
    is_active: true,
  });

  if (error) {
    console.error('Failed to create super admin:', error);
    process.exit(1);
  }

  console.log(`Super admin created: ${email}`);
  console.log('Change the password on first login.');
}

seed().catch(console.error);
