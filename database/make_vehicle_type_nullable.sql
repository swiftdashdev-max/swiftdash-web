-- ========================================
-- MIGRATION: Make vehicle_type_id nullable
-- Purpose: Enable staging workflow where orders are created 
--          before vehicle assignment in dispatch
-- ========================================

-- 1. Drop the existing foreign key constraint
ALTER TABLE public.deliveries 
DROP CONSTRAINT IF EXISTS deliveries_vehicle_type_id_fkey;

-- 2. Make vehicle_type_id nullable
ALTER TABLE public.deliveries 
ALTER COLUMN vehicle_type_id DROP NOT NULL;

-- 3. Re-add the foreign key constraint (now nullable)
ALTER TABLE public.deliveries 
ADD CONSTRAINT deliveries_vehicle_type_id_fkey 
FOREIGN KEY (vehicle_type_id) 
REFERENCES public.vehicle_types(id);

-- 4. Verify the change
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'deliveries'
  AND column_name IN ('vehicle_type_id', 'driver_id', 'fleet_vehicle_id');
