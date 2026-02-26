-- Atomic swap of two funnel stage positions inside a single transaction.
-- Called from FunnelContext.moveStage to avoid race conditions.

CREATE OR REPLACE FUNCTION public.swap_funnel_stage_positions(
  p_stage_id_a UUID,
  p_position_a INTEGER,
  p_stage_id_b UUID,
  p_position_b INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.funnel_stages SET position = p_position_a WHERE id = p_stage_id_a;
  UPDATE public.funnel_stages SET position = p_position_b WHERE id = p_stage_id_b;
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_funnel_stage_positions TO authenticated;
