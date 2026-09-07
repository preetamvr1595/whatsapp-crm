-- Migration: Store Email Provider Configurations per User/Tenant
-- Supports Resend, SendGrid, and custom SMTP integrations for multi-channel email campaigns

CREATE TABLE IF NOT EXISTS email_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('resend', 'sendgrid', 'smtp')),
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  api_key TEXT,
  smtp_host TEXT,
  smtp_port INT,
  smtp_user TEXT,
  smtp_pass TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own email config" ON email_config;
CREATE POLICY "Users can manage their own email config"
  ON email_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_config_user_id ON email_config(user_id);

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS set_email_config_updated_at ON email_config;
CREATE TRIGGER set_email_config_updated_at
  BEFORE UPDATE ON email_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
