-- Migration: Add broadcast parallel sending support
-- This adds fields to track parallel broadcast execution

ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS worker_count INT DEFAULT 3;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS messages_per_second DECIMAL(5,2);
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 1;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS queued_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS send_mode TEXT DEFAULT 'sequential' CHECK (send_mode IN ('sequential', 'parallel'));

-- Add index for faster broadcast lookups
CREATE INDEX IF NOT EXISTS idx_broadcasts_user_status 
  ON broadcasts(user_id, status) 
  WHERE status NOT IN ('completed', 'failed');

-- Track broadcast worker execution
CREATE TABLE IF NOT EXISTS broadcast_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  worker_id INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  messages_sent INT DEFAULT 0,
  messages_failed INT DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_broadcast_workers_broadcast 
  ON broadcast_workers(broadcast_id);

-- Enable RLS on broadcast_workers
ALTER TABLE broadcast_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their broadcast workers"
  ON broadcast_workers FOR SELECT
  USING (broadcast_id IN (
    SELECT id FROM broadcasts WHERE user_id = auth.uid()
  ));
