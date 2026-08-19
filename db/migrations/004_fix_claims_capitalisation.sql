-- Follow-up to the acronym-preserving capitalisation pass: do not let the
-- "CL" acronym correction affect ordinary words like Claims.

BEGIN;

UPDATE lookup_values
SET label = replace(replace(label, 'CLaims', 'Claims'), 'CLaim', 'Claim')
WHERE label LIKE '%CLaim%';

COMMIT;
