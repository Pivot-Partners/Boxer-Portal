/**
 * Seeds all stores from the CSV files in supporting docs/docs/
 * Run once after applying the DB schema: npx tsx scripts/seed-stores.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { join } from 'path';
import 'dotenv/config';

const DOCS_DIR = join(__dirname, '../supporting docs/docs');

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type StoreRow = { category: string; name: string };

function loadCsv(file: string, category: string, nameCol = 'Store name'): StoreRow[] {
  const content = readFileSync(join(DOCS_DIR, file), 'utf-8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  return rows
    .map((r: Record<string, string>) => ({ category, name: r[nameCol]?.trim() ?? '' }))
    .filter((r: StoreRow) => r.name.length > 0);
}

async function seed() {
  console.log('Seeding stores...');

  const stores: StoreRow[] = [
    ...loadCsv('Boxer store list 2 Dec 2025 - Supermarkets and Minis.csv', 'supermarket_mini'),
    ...loadCsv('Boxer store list 2 Dec 2025 - Liquor.csv', 'liquor'),
    ...loadCsv('Boxer store list 2 Dec 2025 - Build.csv', 'build'),
    ...loadCsv('Boxer store list 2 Dec 2025 - DCs.csv', 'distribution_center', 'DC name'),
    { category: 'meat_factory', name: 'Ballito Meat Factory' },
    { category: 'head_office', name: 'Boxer Head Office' },
  ];

  // Delete existing (except meat_factory and head_office already seeded in SQL)
  await db.from('stores').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert in batches of 100
  for (let i = 0; i < stores.length; i += 100) {
    const batch = stores.slice(i, i + 100);
    const { error } = await db.from('stores').insert(batch.map(s => ({ ...s, is_active: true })));
    if (error) {
      console.error('Insert error:', error);
      process.exit(1);
    }
    console.log(`Inserted ${Math.min(i + 100, stores.length)} / ${stores.length}`);
  }

  console.log(`Done — ${stores.length} stores seeded.`);
}

seed().catch(console.error);
