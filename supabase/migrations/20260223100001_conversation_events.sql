-- Conversation event log: tracks every meaningful change in a conversation
CREATE TABLE IF NOT EXISTS public.conversation_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type  text NOT NULL,  -- status_change | annotation | agent_assigned | chatbot_trigger | tag_added | tag_removed
  payload     jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_events_conversation ON public.conversation_events(conversation_id, created_at DESC);

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view events"
  ON public.conversation_events FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company members can insert events"
  ON public.conversation_events FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Trigger: log status changes automatically
CREATE OR REPLACE FUNCTION public.log_conversation_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.conversation_events (company_id, conversation_id, event_type, payload)
    VALUES (
      NEW.company_id,
      NEW.id,
      'status_change',
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  IF OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id THEN
    INSERT INTO public.conversation_events (company_id, conversation_id, event_type, payload)
    VALUES (
      NEW.company_id,
      NEW.id,
      'agent_assigned',
      jsonb_build_object('from', OLD.assigned_user_id, 'to', NEW.assigned_user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_conversation_changes ON public.conversations;
CREATE TRIGGER trg_log_conversation_changes
  AFTER UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.log_conversation_status_change();
