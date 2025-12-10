-- Make total_price nullable to support staged pricing workflow
-- Pricing will be calculated and set during dispatch assignment, not at order creation

-- Step 1: Make total_price nullable
ALTER TABLE deliveries 
ALTER COLUMN total_price DROP NOT NULL;

-- Step 2: Update existing orders with 0 price to NULL (optional - helps distinguish between set and unset)
UPDATE deliveries 
SET total_price = NULL 
WHERE total_price = 0 
  AND status IN ('pending', 'assigned');

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'deliveries'
  AND column_name = 'total_price';
