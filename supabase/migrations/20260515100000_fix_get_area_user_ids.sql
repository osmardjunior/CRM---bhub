-- Fix get_area_user_ids: query ALL users with matching macro_area permission,
-- not just those in the caller's company. The company filtering is handled
-- by the frontend (useTeamProfiles filters by company_id).
CREATE OR REPLACE FUNCTION public.get_area_user_ids(p_micro_area_ids text[])
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT uap.user_id
  FROM public.user_area_permissions uap
  JOIN public.micro_areas ma ON ma.macro_area_id = uap.macro_area_id
  WHERE ma.id = ANY(p_micro_area_ids);
$$;
