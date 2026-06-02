-- Add cancelled_by_admin as a valid application status
ALTER TABLE applications
	DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE applications
	ADD CONSTRAINT applications_status_check CHECK (
		status IN (
			'pending',
			'cancelled_by_employee',
			'cancelled_by_admin',
			'superseded',
			'cancelled_no_whitelist',
			'cancelled_no_stock',
			'validated',
			'converted_to_order',
			'rejected'
		)
	);
