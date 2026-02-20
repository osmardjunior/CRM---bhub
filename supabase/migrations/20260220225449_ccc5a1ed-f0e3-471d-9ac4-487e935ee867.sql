
-- =====================================================
-- PART 1: Add missing columns to existing tables
-- =====================================================

-- Contacts: add CRM fields
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS chatbot_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS attendance_status TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS has_unread BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS origin_device_id UUID;

-- Messages: add direction, type, delivery tracking, reply support
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS sent_by TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS client_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS server_timestamp TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID,
  ADD COLUMN IF NOT EXISTS processed_by_bot BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_annotation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS media_file_id TEXT;

-- =====================================================
-- PART 2: New junction / metadata tables
-- =====================================================

-- Contact-Tags M:N (proper normalization)
CREATE TABLE IF NOT EXISTS public.contact_tags (
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contact_id, tag_id)
);
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company contact_tags" ON public.contact_tags FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company contact_tags" ON public.contact_tags FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can delete company contact_tags" ON public.contact_tags FOR DELETE USING (company_id = get_user_company_id());

-- Custom Field Definitions
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company custom_field_definitions" ON public.custom_field_definitions FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Admins can manage custom_field_definitions" ON public.custom_field_definitions FOR ALL USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- Custom Field Values
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  value TEXT,
  company_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, field_definition_id)
);
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company custom_field_values" ON public.custom_field_values FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can upsert company custom_field_values" ON public.custom_field_values FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company custom_field_values" ON public.custom_field_values FOR UPDATE USING (company_id = get_user_company_id());

-- Contact Funnel Stages (per contact per funnel)
CREATE TABLE IF NOT EXISTS public.contact_funnel_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.funnel_stages(id),
  company_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, funnel_id)
);
ALTER TABLE public.contact_funnel_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company contact_funnel_stages" ON public.contact_funnel_stages FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company contact_funnel_stages" ON public.contact_funnel_stages FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company contact_funnel_stages" ON public.contact_funnel_stages FOR UPDATE USING (company_id = get_user_company_id());

-- Contact Assignees (multi-assignee)
CREATE TABLE IF NOT EXISTS public.contact_assignees (
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contact_id, user_id)
);
ALTER TABLE public.contact_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company contact_assignees" ON public.contact_assignees FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company contact_assignees" ON public.contact_assignees FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can delete company contact_assignees" ON public.contact_assignees FOR DELETE USING (company_id = get_user_company_id());

-- Attendance History
CREATE TABLE IF NOT EXISTS public.attendance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT,
  changed_by_user_id UUID,
  duration_seconds INTEGER,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.attendance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company attendance_history" ON public.attendance_history FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company attendance_history" ON public.attendance_history FOR INSERT WITH CHECK (company_id = get_user_company_id());

-- Delegation History
CREATE TABLE IF NOT EXISTS public.delegation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  user_id UUID,
  actor_id UUID,
  is_automatic BOOLEAN DEFAULT false,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.delegation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company delegation_history" ON public.delegation_history FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company delegation_history" ON public.delegation_history FOR INSERT WITH CHECK (company_id = get_user_company_id());

-- Scheduled Messages
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  media_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company scheduled_messages" ON public.scheduled_messages FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company scheduled_messages" ON public.scheduled_messages FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company scheduled_messages" ON public.scheduled_messages FOR UPDATE USING (company_id = get_user_company_id());

-- Message Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company message_reactions" ON public.message_reactions FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company message_reactions" ON public.message_reactions FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can delete own message_reactions" ON public.message_reactions FOR DELETE USING (company_id = get_user_company_id() AND user_id = auth.uid());

-- AI Interactions (usage tracking)
CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id),
  conversation_id UUID REFERENCES public.conversations(id),
  user_id UUID,
  interaction_type TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  model_used TEXT,
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company ai_interactions" ON public.ai_interactions FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company ai_interactions" ON public.ai_interactions FOR INSERT WITH CHECK (company_id = get_user_company_id());

-- AI Automation Suggestions
CREATE TABLE IF NOT EXISTS public.ai_automation_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id),
  conversation_id UUID REFERENCES public.conversations(id),
  suggestion_json JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ai_automation_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company ai_suggestions" ON public.ai_automation_suggestions FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company ai_suggestions" ON public.ai_automation_suggestions FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company ai_suggestions" ON public.ai_automation_suggestions FOR UPDATE USING (company_id = get_user_company_id());

-- AI Reports
CREATE TABLE IF NOT EXISTS public.ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  content_md TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  company_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view company ai_reports" ON public.ai_reports FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert company ai_reports" ON public.ai_reports FOR INSERT WITH CHECK (company_id = get_user_company_id());

-- =====================================================
-- PART 3: Enable realtime on new tables
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delegation_history;

-- =====================================================
-- PART 4: Auto-set company_id triggers for new tables
-- =====================================================
CREATE TRIGGER set_contact_tags_company BEFORE INSERT ON public.contact_tags FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_custom_field_defs_company BEFORE INSERT ON public.custom_field_definitions FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_custom_field_vals_company BEFORE INSERT ON public.custom_field_values FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_contact_funnel_stages_company BEFORE INSERT ON public.contact_funnel_stages FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_contact_assignees_company BEFORE INSERT ON public.contact_assignees FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_attendance_history_company BEFORE INSERT ON public.attendance_history FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_delegation_history_company BEFORE INSERT ON public.delegation_history FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_scheduled_messages_company BEFORE INSERT ON public.scheduled_messages FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_message_reactions_company BEFORE INSERT ON public.message_reactions FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_ai_interactions_company BEFORE INSERT ON public.ai_interactions FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_ai_suggestions_company BEFORE INSERT ON public.ai_automation_suggestions FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
CREATE TRIGGER set_ai_reports_company BEFORE INSERT ON public.ai_reports FOR EACH ROW EXECUTE FUNCTION auto_set_company_id();
