import type { FastifyPluginAsync } from 'fastify';
import ExcelJS from 'exceljs';
import { decrypt } from '../../services/auth/encryptionService';

// Category enum → HR display label
const CATEGORY_LABELS: Record<string, string> = {
	supermarket_mini: 'Boxer Supermarket or Boxer Mini',
	liquor: 'Boxer Liquor',
	build: 'Boxer Build',
	distribution_center: 'Distribution Center',
	meat_factory: 'Meat Factory',
	head_office: 'Head Office',
};

// HR column order — must match the Final Successful List HR exactly
const HR_COLUMNS = [
	'Date of application',
	'Full name',
	'Surname',
	'Employee number',
	'ID Number',
	'Phone number',
	'Email',
	'Place of Work',
	'Location',
	'Which Phone',
	'Buy for Cash',
	'Rent 7 Months',
	'Rent 13 Months',
	'Cancellation Request',
	'First deduction',
	'Deductions after first deduction',
	'Number of subsequent deductions',
	'Term',
];

function formatDate(iso: string): string {
	const d = new Date(iso);
	const M = d.getMonth() + 1;
	const D = d.getDate();
	const Y = d.getFullYear();
	const h = d.getHours();
	const m = String(d.getMinutes()).padStart(2, '0');
	const s = String(d.getSeconds()).padStart(2, '0');
	return `${M}/${D}/${Y} ${h}:${m}:${s}`;
}

function safeDecrypt(value: string | null | undefined): string {
	if (!value) return '';
	try {
		return decrypt(value);
	} catch {
		return '';
	}
}

const exportRoute: FastifyPluginAsync = async (fastify) => {
	// GET /m1/batches/:id/export — generate HR Excel for a closed/approved batch
	fastify.get('/m1/batches/:id/export', {
		preHandler: fastify.requireRole('m1_admin', 'super_admin'),
	}, async (request, reply) => {
		const { id } = request.params as { id: string };

		// Fetch batch and confirm it is past open status
		const { data: batch, error: batchError } = await fastify.db
			.from('batches')
			.select('id, batch_month, status')
			.eq('id', id)
			.single();

		if (batchError || !batch) {
			return reply.code(404).send({ success: false, error: 'Batch not found' });
		}

		if (batch.status === 'open') {
			return reply.code(400).send({ success: false, error: 'Batch is still open — close it before exporting' });
		}

		// Fetch all non-cancelled, non-superseded applications with their catalogue + store data
		const { data: apps, error: appsError } = await fastify.db
			.from('applications')
			.select(`
				id,
				submitted_at,
				first_name,
				last_name,
				display_name,
				employee_number_encrypted,
				id_number_encrypted,
				contact_number,
				email,
				place_of_work,
				rental_term,
				batch_phone_catalogue (
					model_name,
					cash_price,
					upfront_amount,
					rental_amount_7m,
					rental_amount_13m
				),
				stores (
					category
				)
			`)
			.eq('batch_id', id)
			.in('status', ['pending', 'validated', 'converted_to_order'])
			.order('submitted_at', { ascending: true });

		if (appsError) {
			fastify.log.error(appsError, 'Failed to fetch applications for export');
			return reply.code(500).send({ success: false, error: 'Failed to fetch applications' });
		}

		// Build Excel
		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'Boxer Operations Portal';
		workbook.created = new Date();

		const ws = workbook.addWorksheet('Successful Applications');

		// Header row
		ws.addRow(HR_COLUMNS);
		const headerRow = ws.getRow(1);
		headerRow.font = { bold: true };
		headerRow.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFD9D9D9' },
		};

		// Column widths
		const widths = [22, 20, 20, 16, 16, 16, 28, 28, 22, 24, 12, 14, 14, 18, 16, 28, 26, 8];
		HR_COLUMNS.forEach((_, i) => {
			ws.getColumn(i + 1).width = widths[i] ?? 16;
		});

		// Data rows
		for (const app of (apps ?? [])) {
			const catalogue = (app as any).batch_phone_catalogue;
			const store = (app as any).stores;

			const rentalTerm: number = app.rental_term;
			const isCash = rentalTerm === 0;
			const is7m = rentalTerm === 7;
			const is13m = rentalTerm === 13;

			// Deduction columns derived from locked catalogue prices
			let firstDeduction: number | string = '';
			let deductionsAfter: number | string = '';
			let subsequentCount: number | string = '';
			let term: number | string = '';

			if (catalogue) {
				if (isCash) {
					firstDeduction = catalogue.cash_price;
					deductionsAfter = '';
					subsequentCount = '';
					term = 'CASH';
				} else if (is7m) {
					firstDeduction = catalogue.upfront_amount;
					deductionsAfter = catalogue.rental_amount_7m;
					subsequentCount = 6;
					term = 7;
				} else if (is13m) {
					firstDeduction = catalogue.upfront_amount;
					deductionsAfter = catalogue.rental_amount_13m;
					subsequentCount = 12;
					term = 13;
				}
			}

			const categoryLabel = store?.category ? (CATEGORY_LABELS[store.category] ?? store.category) : '';

			// Derive first/last name: prefer stored split, fall back to splitting display_name
			let firstName = (app as any).first_name ?? '';
			let lastName = (app as any).last_name ?? '';
			if (!firstName && !lastName && (app as any).display_name) {
				const parts = ((app as any).display_name as string).trim().split(/\s+/);
				lastName = parts.pop() ?? '';
				firstName = parts.join(' ');
			}

			ws.addRow([
				formatDate((app as any).submitted_at),
				firstName,
				lastName,
				safeDecrypt((app as any).employee_number_encrypted),
				safeDecrypt((app as any).id_number_encrypted),
				(app as any).contact_number ?? '',
				(app as any).email ?? '',
				categoryLabel,
				(app as any).place_of_work ?? '',
				catalogue?.model_name ?? '',
				isCash ? 1 : 0,
				is7m ? 1 : 0,
				is13m ? 1 : 0,
				0, // Cancellation Request — always 0 for successful applications
				firstDeduction,
				deductionsAfter,
				subsequentCount,
				term,
			]);
		}

		// Freeze header row
		ws.views = [{ state: 'frozen', ySplit: 1 }];

		// Generate buffer and stream as download
		const buffer = await workbook.xlsx.writeBuffer();

		const batchMonthLabel = batch.batch_month
			? new Date(batch.batch_month).toISOString().slice(0, 7)
			: id.slice(0, 8);

		reply
			.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
			.header('Content-Disposition', `attachment; filename="HR_Successful_Applications_${batchMonthLabel}.xlsx"`)
			.send(Buffer.from(buffer));
	});
};

export default exportRoute;
