import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { parse as csvParse } from 'csv-parse/sync';

// Static spelling aliases → canonical category key.
// Covers common variations found in HR Excel/CSV exports.
const CATEGORY_ALIASES: Record<string, string> = {
	'supermarkets and minis': 'supermarket_mini',
	'supermarket and minis': 'supermarket_mini',
	'supermarkets': 'supermarket_mini',
	'supermarket': 'supermarket_mini',
	'supermarket_mini': 'supermarket_mini',
	'boxer supermarket': 'supermarket_mini',
	'boxer supermarket or boxer mini': 'supermarket_mini',
	'minis': 'supermarket_mini',
	'mini': 'supermarket_mini',
	'liquor': 'liquor',
	'boxer liquor': 'liquor',
	'build': 'build',
	'boxer build': 'build',
	'distribution center': 'distribution_center',
	'distribution centre': 'distribution_center',
	'distribution centers': 'distribution_center',
	'distribution centres': 'distribution_center',
	'distribution_center': 'distribution_center',
	'dc': 'distribution_center',
	'dcs': 'distribution_center',
	'meat factory': 'meat_factory',
	'meat_factory': 'meat_factory',
	'head office': 'head_office',
	'head_office': 'head_office',
	'ho': 'head_office',
};

// Resolves a raw string (e.g. sheet name, CSV column) to a valid category key.
// Try static aliases first, then direct key match, then underscore-slug match.
function normalizeCategory(raw: string, validKeys: Set<string>): string | null {
	const lower = raw.trim().toLowerCase();
	const fromAlias = CATEGORY_ALIASES[lower];
	if (fromAlias && validKeys.has(fromAlias)) return fromAlias;
	if (validKeys.has(lower)) return lower;
	const slugged = lower.replace(/\s+/g, '_');
	if (validKeys.has(slugged)) return slugged;
	return null;
}

async function fetchValidCategoryKeys(fastify: FastifyInstance): Promise<Set<string>> {
	const { data } = await fastify.db
		.from('store_categories')
		.select('key')
		.eq('is_active', true);
	return new Set<string>((data ?? []).map((r: any) => r.key));
}

const createStoreSchema = z.object({
	name: z.string().min(1).max(255).trim(),
	category: z.string().min(1).max(50).trim(),
	store_code: z.string().max(50).trim().nullable().optional(),
});

const updateStoreSchema = z.object({
	name: z.string().min(1).max(255).trim().optional(),
	category: z.string().min(1).max(50).trim().optional(),
	store_code: z.string().max(50).trim().nullable().optional(),
	is_active: z.boolean().optional(),
});

const HEADER_VARIANTS = ['store name', 'dc name', 'name', 'store'];

async function parseExcel(
	buffer: Buffer,
	validKeys: Set<string>,
): Promise<{ rows: Array<{ name: string; category: string }>; unrecognized: string[] }> {
	const workbook = new ExcelJS.Workbook();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	await workbook.xlsx.load(buffer as any); // @types/node v20 Buffer<ArrayBufferLike> vs ExcelJS Buffer mismatch

	const rows: Array<{ name: string; category: string }> = [];
	const unrecognizedSet = new Set<string>();

	workbook.eachSheet((sheet) => {
		const category = normalizeCategory(sheet.name, validKeys);
		if (!category) {
			unrecognizedSet.add(sheet.name.trim());
			return;
		}

		let nameColIndex = 1;
		sheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) {
				row.eachCell((cell, colNumber) => {
					if (HEADER_VARIANTS.includes((cell.text ?? '').trim().toLowerCase())) {
						nameColIndex = colNumber;
					}
				});
				return;
			}
			const rawName = row.getCell(nameColIndex).text?.trim();
			if (rawName && !HEADER_VARIANTS.includes(rawName.toLowerCase())) {
				rows.push({ name: rawName, category });
			}
		});
	});

	return { rows, unrecognized: [...unrecognizedSet] };
}

function parseCSV(
	buffer: Buffer,
	forcedCategory: string | null,
	validKeys: Set<string>,
): { rows: Array<{ name: string; category: string }>; unrecognized: string[] } {
	const records = csvParse(buffer, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
		bom: true,
	}) as Record<string, string>[];

	const rows: Array<{ name: string; category: string }> = [];
	const unrecognizedSet = new Set<string>();

	for (const record of records) {
		const name =
			record['Store name'] ??
			record['DC name'] ??
			record['Name'] ??
			record['store name'] ??
			Object.values(record)[0];

		if (!name?.trim()) continue;

		const rawCat = record['Category'] ?? record['category'] ?? null;
		const category = rawCat ? normalizeCategory(rawCat, validKeys) : forcedCategory;
		if (!category) {
			if (rawCat) unrecognizedSet.add(rawCat.trim());
			continue;
		}

		rows.push({ name: name.trim(), category });
	}

	return { rows, unrecognized: [...unrecognizedSet] };
}

const storesRoute: FastifyPluginAsync = async (fastify) => {
	// Public — employee application form (grouped by category)
	fastify.get('/m1/stores', async (request, reply) => {
		const { data, error } = await fastify.db
			.from('stores')
			.select('id, category, name, store_code')
			.eq('is_active', true)
			.order('name');

		if (error) {
			fastify.log.error(error);
			return reply.code(500).send({ success: false, error: 'Failed to fetch stores' });
		}

		const grouped: Record<string, typeof data> = {};
		for (const store of data ?? []) {
			if (!grouped[store.category]) grouped[store.category] = [];
			grouped[store.category]!.push(store);
		}

		return reply.send({ success: true, data: grouped });
	});

	// Admin — flat list with optional filters
	fastify.get('/m1/stores/admin', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { category, include_inactive } = request.query as {
			category?: string;
			include_inactive?: string;
		};

		let query = fastify.db
			.from('stores')
			.select('id, category, name, store_code, is_active, created_at, updated_at');

		if (category) {
			query = query.eq('category', category);
		}

		if (include_inactive !== 'true') {
			query = query.eq('is_active', true);
		}

		const { data, error } = await query.order('category').order('name');

		if (error) {
			fastify.log.error(error);
			return reply.code(500).send({ success: false, error: 'Failed to fetch stores' });
		}

		return reply.send({ success: true, data: data ?? [] });
	});

	// Admin — create single store
	fastify.post('/m1/stores', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const parsed = createStoreSchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.code(422).send({ success: false, error: 'Invalid input', details: parsed.error.flatten() });
		}

		const { name, category, store_code } = parsed.data;

		// Validate category exists in store_categories
		const { data: catRow } = await fastify.db
			.from('store_categories')
			.select('key')
			.eq('key', category)
			.eq('is_active', true)
			.maybeSingle();

		if (!catRow) {
			return reply.code(422).send({ success: false, error: 'Invalid or inactive category' });
		}

		const { data: existing } = await fastify.db
			.from('stores')
			.select('id, is_active')
			.eq('category', category)
			.ilike('name', name)
			.maybeSingle();

		if (existing) {
			if (existing.is_active) {
				return reply.code(409).send({ success: false, error: 'A store with this name already exists in this category' });
			}
			const { data: updated, error } = await fastify.db
				.from('stores')
				.update({ is_active: true, name, store_code: store_code ?? null, updated_at: new Date().toISOString() })
				.eq('id', existing.id)
				.select()
				.single();

			if (error) return reply.code(500).send({ success: false, error: 'Failed to reactivate store' });
			return reply.send({ success: true, data: updated, reactivated: true });
		}

		const { data: inserted, error } = await fastify.db
			.from('stores')
			.insert({ name, category, store_code: store_code ?? null, is_active: true })
			.select()
			.single();

		if (error) {
			fastify.log.error(error);
			return reply.code(500).send({ success: false, error: 'Failed to create store' });
		}

		return reply.code(201).send({ success: true, data: inserted });
	});

	// Admin — bulk upload via CSV or Excel
	fastify.post('/m1/stores/upload', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const file = await request.file();
		if (!file) {
			return reply.code(400).send({ success: false, error: 'No file uploaded' });
		}

		// Load valid categories from DB before parsing
		const { data: categoryRows, error: catError } = await fastify.db
			.from('store_categories')
			.select('key')
			.eq('is_active', true);

		if (catError) {
			fastify.log.error(catError);
			return reply.code(500).send({ success: false, error: 'Failed to load categories' });
		}

		const validKeys = new Set<string>((categoryRows ?? []).map((r: any) => r.key));

		const { category: categoryParam } = request.query as { category?: string };
		const buffer = await file.toBuffer();
		const fileName = file.filename.toLowerCase();

		let rows: Array<{ name: string; category: string }>;
		let unrecognized: string[];

		try {
			if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
				const result = await parseExcel(buffer, validKeys);
				rows = result.rows;
				unrecognized = result.unrecognized;
			} else if (fileName.endsWith('.csv')) {
				const forcedCategory = categoryParam ? normalizeCategory(categoryParam, validKeys) : null;
				const result = parseCSV(buffer, forcedCategory, validKeys);
				rows = result.rows;
				unrecognized = result.unrecognized;
			} else {
				return reply.code(400).send({ success: false, error: 'Only .csv and .xlsx files are supported' });
			}
		} catch (err: any) {
			return reply.code(400).send({ success: false, error: `Failed to parse file: ${err.message}` });
		}

		if (rows.length === 0 && unrecognized.length === 0) {
			return reply.code(400).send({ success: false, error: 'No valid rows found in file' });
		}

		// If only unrecognized categories, return early with feedback
		if (rows.length === 0) {
			return reply.send({
				success: true,
				data: { parsed: 0, inserted: 0, reactivated: 0, skipped: 0, unrecognized_categories: unrecognized },
			});
		}

		// Load all existing stores once (~550 rows)
		const { data: allStores } = await fastify.db
			.from('stores')
			.select('id, category, name, is_active');

		const existingMap = new Map<string, { id: string; is_active: boolean }>();
		for (const s of allStores ?? []) {
			existingMap.set(`${s.category}::${s.name.trim().toLowerCase()}`, { id: s.id, is_active: s.is_active });
		}

		const toInsert: Array<{ name: string; category: string; is_active: boolean }> = [];
		const toReactivate: string[] = [];
		let skipped = 0;

		for (const row of rows) {
			const key = `${row.category}::${row.name.trim().toLowerCase()}`;
			const existing = existingMap.get(key);

			if (!existing) {
				toInsert.push({ name: row.name.trim(), category: row.category, is_active: true });
				existingMap.set(key, { id: '__pending__', is_active: true });
			} else if (!existing.is_active) {
				toReactivate.push(existing.id);
				existingMap.set(key, { ...existing, is_active: true });
			} else {
				skipped++;
			}
		}

		let inserted = 0;
		for (let i = 0; i < toInsert.length; i += 100) {
			const { error } = await fastify.db.from('stores').insert(toInsert.slice(i, i + 100));
			if (error) {
				fastify.log.error(error);
				return reply.code(500).send({ success: false, error: 'Failed to insert stores' });
			}
			inserted += Math.min(100, toInsert.length - i);
		}

		let reactivated = 0;
		for (let i = 0; i < toReactivate.length; i += 100) {
			const { error } = await fastify.db
				.from('stores')
				.update({ is_active: true, updated_at: new Date().toISOString() })
				.in('id', toReactivate.slice(i, i + 100));
			if (!error) reactivated += Math.min(100, toReactivate.length - i);
		}

		return reply.send({
			success: true,
			data: { parsed: rows.length, inserted, reactivated, skipped, unrecognized_categories: unrecognized },
		});
	});

	// Admin — update store (name, category, store_code, is_active)
	fastify.patch('/m1/stores/:id', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { id } = request.params as { id: string };
		const parsed = updateStoreSchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.code(422).send({ success: false, error: 'Invalid input' });
		}

		const updates = parsed.data;
		if (Object.keys(updates).length === 0) {
			return reply.code(422).send({ success: false, error: 'Nothing to update' });
		}

		// Validate new category if being changed
		if (updates.category !== undefined) {
			const { data: catRow } = await fastify.db
				.from('store_categories')
				.select('key')
				.eq('key', updates.category)
				.eq('is_active', true)
				.maybeSingle();

			if (!catRow) {
				return reply.code(422).send({ success: false, error: 'Invalid or inactive category' });
			}
		}

		if (updates.name) {
			const { data: current } = await fastify.db
				.from('stores')
				.select('category')
				.eq('id', id)
				.single();

			const targetCategory = updates.category ?? current?.category;

			const { data: conflict } = await fastify.db
				.from('stores')
				.select('id')
				.eq('category', targetCategory)
				.ilike('name', updates.name)
				.neq('id', id)
				.eq('is_active', true)
				.maybeSingle();

			if (conflict) {
				return reply.code(409).send({
					success: false,
					error: 'Another active store with this name already exists in this category',
				});
			}
		}

		const { data, error } = await fastify.db
			.from('stores')
			.update({ ...updates, updated_at: new Date().toISOString() })
			.eq('id', id)
			.select()
			.single();

		if (error) {
			return reply.code(500).send({ success: false, error: 'Failed to update store' });
		}

		return reply.send({ success: true, data });
	});
};

export default storesRoute;
