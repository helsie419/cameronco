-- Lets a specific staff member approve quotes without reclassifying their
-- role to 'admin' (which would also relabel their job title everywhere else
-- staff.role is shown). Approval in POST /quotes/:id/review now passes for
-- role='admin' OR can_approve_quotes=true.

BEGIN;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS can_approve_quotes BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
