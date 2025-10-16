-- Enable RLS on vehicle_types table if not already enabled
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to vehicle types" ON vehicle_types;

-- Create policy to allow anonymous read access to vehicle types
CREATE POLICY "Allow public read access to vehicle types" ON vehicle_types
FOR SELECT USING (true);

-- Insert some sample vehicle types if they don't exist
INSERT INTO vehicle_types (id, name, description, created_at, updated_at) VALUES
('motorcycle', 'Motorcycle', 'Two-wheeled motor vehicle', NOW(), NOW()),
('tricycle', 'Tricycle', 'Three-wheeled motor vehicle', NOW(), NOW()),
('jeepney', 'Jeepney', 'Traditional Filipino public utility vehicle', NOW(), NOW()),
('van', 'Van', 'Multi-purpose vehicle for passengers or cargo', NOW(), NOW()),
('truck', 'Truck', 'Large motor vehicle for transporting goods', NOW(), NOW()),
('car', 'Car', 'Four-wheeled passenger vehicle', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;