-- Migration: Store form responses from automations
-- Captures structured data collected via in-chat forms

CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,
  broadcast_id UUID REFERENCES broadcasts(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  field_value TEXT,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'email', 'number', 'date', 'select')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_valid BOOLEAN DEFAULT TRUE,
  validation_error TEXT
);

-- Enable RLS
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view form responses from their contacts"
  ON form_responses FOR SELECT
  USING (contact_id IN (
    SELECT id FROM contacts WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert form responses for their contacts"
  ON form_responses FOR INSERT
  WITH CHECK (contact_id IN (
    SELECT id FROM contacts WHERE user_id = auth.uid()
  ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_form_responses_contact 
  ON form_responses(contact_id);

CREATE INDEX IF NOT EXISTS idx_form_responses_automation 
  ON form_responses(automation_id);

CREATE INDEX IF NOT EXISTS idx_form_responses_submitted 
  ON form_responses(submitted_at DESC);
