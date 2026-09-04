-- Migration: Add audience segmentation filters
-- Allows users to save and reuse audience filter templates

CREATE TABLE IF NOT EXISTS audience_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_config JSONB NOT NULL,
  contact_count INT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: user can't have duplicate filter names
ALTER TABLE audience_filters 
  DROP CONSTRAINT IF EXISTS unique_user_filter_name;
ALTER TABLE audience_filters 
  ADD CONSTRAINT unique_user_filter_name 
  UNIQUE(user_id, name);

-- Enable RLS
ALTER TABLE audience_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own filters"
  ON audience_filters FOR SELECT
  USING (user_id = auth.uid() OR is_public = TRUE);

CREATE POLICY "Users can only create filters for themselves"
  ON audience_filters FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update their own filters"
  ON audience_filters FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only delete their own filters"
  ON audience_filters FOR DELETE
  USING (user_id = auth.uid());

-- Add index for faster filter lookups
CREATE INDEX IF NOT EXISTS idx_audience_filters_user 
  ON audience_filters(user_id);

CREATE INDEX IF NOT EXISTS idx_audience_filters_name 
  ON audience_filters(user_id, name);
