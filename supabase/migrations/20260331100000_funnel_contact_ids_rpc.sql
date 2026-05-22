-- RPC to get contact_ids in a funnel (optionally filtered by stage)
-- Used by leads report to filter conversations by funnel membership
CREATE OR REPLACE FUNCTION public.get_funnel_contact_ids(
  p_funnel_id UUID,
  p_stage_id UUID DEFAULT NULL
)
RETURNS TABLE(contact_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT cfs.contact_id
  FROM public.contact_funnel_stages cfs
  WHERE cfs.funnel_id = p_funnel_id
    AND (p_stage_id IS NULL OR cfs.stage_id = p_stage_id);
$$;

-- Multi-funnel RPC: accepts arrays of funnel_ids (stage_ids ignored, kept for compat)
CREATE OR REPLACE FUNCTION public.get_funnel_contact_ids_multi(
  p_funnel_ids UUID[],
  p_stage_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(contact_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT cfs.contact_id
  FROM public.contact_funnel_stages cfs
  WHERE cfs.funnel_id = ANY(p_funnel_ids)
    AND (p_stage_ids IS NULL OR cfs.stage_id = ANY(p_stage_ids));
$$;

-- Stage-only RPC: get contact_ids by stage_ids (independent of funnel selection)
CREATE OR REPLACE FUNCTION public.get_stage_contact_ids(
  p_stage_ids UUID[]
)
RETURNS TABLE(contact_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT cfs.contact_id
  FROM public.contact_funnel_stages cfs
  WHERE cfs.stage_id = ANY(p_stage_ids);
$$;
