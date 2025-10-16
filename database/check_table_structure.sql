-- Check the actual structure of driver_verification_submissions table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'driver_verification_submissions' 
ORDER BY ordinal_position;