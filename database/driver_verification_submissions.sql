-- Driver Verification Submissions Table
-- This table stores the verification document submissions from drivers

CREATE TABLE IF NOT EXISTS driver_verification_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- Vehicle Information
    vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id),
    
    -- Document URLs stored as JSONB for flexibility
    documents JSONB DEFAULT '{}',
    -- Example structure:
    -- {
    --   "license": ["url1", "url2"],
    --   "clearance": ["url1"],
    --   "vehicle_or": ["url1"],
    --   "vehicle_cr": ["url1"],
    --   "authorization": ["url1", "url2"],
    --   "vehicle_photos": ["url1", "url2", "url3", "url4"]
    -- }
    
    -- File metadata
    file_names JSONB DEFAULT '{}',
    -- Example structure matching documents but with file names
    
    -- Submission status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'needs_revision')),
    
    -- Review information
    reviewed_by UUID REFERENCES user_profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_driver_verification_user_id ON driver_verification_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_verification_status ON driver_verification_submissions(status);
CREATE INDEX IF NOT EXISTS idx_driver_verification_submitted_at ON driver_verification_submissions(submitted_at);

-- RLS (Row Level Security) policies
ALTER TABLE driver_verification_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own submissions
CREATE POLICY "Users can view own submissions" ON driver_verification_submissions
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own submissions
CREATE POLICY "Users can insert own submissions" ON driver_verification_submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own pending submissions
CREATE POLICY "Users can update own pending submissions" ON driver_verification_submissions
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Policy: Admins can view all submissions (requires admin role)
CREATE POLICY "Admins can view all submissions" ON driver_verification_submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND user_type = 'admin'
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_driver_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_driver_verification_updated_at
    BEFORE UPDATE ON driver_verification_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_verification_updated_at();

-- Optional: Function to get verification status for a user
CREATE OR REPLACE FUNCTION get_driver_verification_status(user_uuid UUID)
RETURNS TABLE (
    submission_id UUID,
    status TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dvs.id,
        dvs.status,
        dvs.submitted_at,
        dvs.reviewed_at,
        dvs.review_notes
    FROM driver_verification_submissions dvs
    WHERE dvs.user_id = user_uuid
    ORDER BY dvs.submitted_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;