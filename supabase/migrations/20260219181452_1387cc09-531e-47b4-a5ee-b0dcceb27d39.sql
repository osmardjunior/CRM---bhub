
-- Enum for node types
CREATE TYPE public.chatbot_node_type AS ENUM (
  'message', 'menu', 'collect_data', 'ai_response', 'transfer', 'condition'
);

-- Chatbot flows table
CREATE TABLE public.chatbot_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  business_hours JSONB NOT NULL DEFAULT '{}',
  offline_message TEXT NOT NULL DEFAULT 'Estamos fora do horário de atendimento. Retornaremos em breve!',
  ai_instructions TEXT NOT NULL DEFAULT '',
  timeout_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chatbot nodes table
CREATE TABLE public.chatbot_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  node_type public.chatbot_node_type NOT NULL DEFAULT 'message',
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add chatbot_current_node to conversations for state tracking
ALTER TABLE public.conversations ADD COLUMN chatbot_current_node UUID REFERENCES public.chatbot_nodes(id) ON DELETE SET NULL DEFAULT NULL;
ALTER TABLE public.conversations ADD COLUMN chatbot_active BOOLEAN NOT NULL DEFAULT false;

-- RLS for chatbot_flows
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company flows"
  ON public.chatbot_flows FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can insert flows"
  ON public.chatbot_flows FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update flows"
  ON public.chatbot_flows FOR UPDATE
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete flows"
  ON public.chatbot_flows FOR DELETE
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- RLS for chatbot_nodes
ALTER TABLE public.chatbot_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company nodes"
  ON public.chatbot_nodes FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Admins can insert nodes"
  ON public.chatbot_nodes FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update nodes"
  ON public.chatbot_nodes FOR UPDATE
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete nodes"
  ON public.chatbot_nodes FOR DELETE
  USING (company_id = get_user_company_id() AND has_role(auth.uid(), 'admin'));

-- Auto-set company_id triggers
CREATE TRIGGER set_chatbot_flows_company_id
  BEFORE INSERT ON public.chatbot_flows
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

CREATE TRIGGER set_chatbot_nodes_company_id
  BEFORE INSERT ON public.chatbot_nodes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- Updated_at trigger for flows
CREATE TRIGGER set_chatbot_flows_updated_at
  BEFORE UPDATE ON public.chatbot_flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ensure only one active flow per company
CREATE UNIQUE INDEX idx_one_active_flow_per_company
  ON public.chatbot_flows (company_id) WHERE (is_active = true);
