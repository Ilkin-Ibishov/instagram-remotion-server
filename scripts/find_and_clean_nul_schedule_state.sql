-- Find rows with NUL in last_error_message or account_id
SELECT id, account_id, next_run_at, last_error_message
FROM schedule_state
WHERE position(E'\000' IN account_id) > 0
   OR position(E'\000' IN COALESCE(last_error_message, '')) > 0;

-- Remove NUL bytes from those columns (backup recommended first)
-- This will replace NUL bytes with empty string
UPDATE schedule_state
SET account_id = replace(account_id, E'\000', ''),
    last_error_message = replace(last_error_message, E'\000', '')
WHERE position(E'\000' IN account_id) > 0
   OR position(E'\000' IN COALESCE(last_error_message, '')) > 0;
