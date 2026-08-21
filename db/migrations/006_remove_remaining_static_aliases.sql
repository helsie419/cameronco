-- Final pass for active lookup aliases revealed by the post-cleanup check.

BEGIN;

UPDATE lookup_values
SET active = false
WHERE domain = 'metal_type'
  AND code IN ('s_silver', 'gold_plated_stg_silver');

UPDATE lookup_values
SET active = false
WHERE domain = 'watch_brand'
  AND code = 'micheal_kors';

COMMIT;
