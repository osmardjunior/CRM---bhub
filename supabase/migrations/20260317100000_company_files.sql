-- Table to store company file metadata with captions
CREATE TABLE IF NOT EXISTS company_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  caption TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE company_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_files_select ON company_files
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY company_files_insert ON company_files
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY company_files_delete ON company_files
  FOR DELETE TO authenticated
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY company_files_update ON company_files
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
