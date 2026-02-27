-- RPC: admin_set_user_role
-- Allows admins to change the role of any user in their company.
-- Uses SECURITY DEFINER to bypass RLS on user_roles (admin-only gate enforced in function body).
-- NOTE: auth.uid() works correctly inside SECURITY DEFINER because Supabase sets
-- the JWT claims in the current transaction before invoking PostgREST RPCs.

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_uid UUID;
  caller_company UUID;
  target_company UUID;
  caller_is_admin BOOLEAN;
BEGIN
  -- Capture caller UID explicitly
  caller_uid := auth.uid();

  -- Gate 1: caller must be admin
  -- Query user_roles directly (SECURITY DEFINER bypasses RLS here)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = caller_uid AND role = 'admin'
  ) INTO caller_is_admin;

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Permission denied: only admins can change user roles (caller: %)', caller_uid;
  END IF;

  -- Gate 2: target user must be in the same company
  SELECT company_id INTO caller_company FROM public.profiles WHERE id = caller_uid;
  SELECT company_id INTO target_company FROM public.profiles WHERE id = target_user_id;

  IF caller_company IS NULL OR target_company IS NULL OR caller_company <> target_company THEN
    RAISE EXCEPTION 'Permission denied: target user not found in your company';
  END IF;

  -- Validate role value
  IF new_role NOT IN ('admin', 'supervisor', 'agent') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  -- Delete all existing roles for target user, then insert the new one
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, new_role::public.app_role);
END;
$$;

-- Grant execute to authenticated users (function body enforces admin-only)
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;
