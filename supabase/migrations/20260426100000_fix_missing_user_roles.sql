-- Fix: ensure every profile has a corresponding user_roles entry.
-- Profiles that exist but have no user_roles default to 'admin' if their
-- auth.users metadata says role='admin', otherwise 'agent'.
-- This corrects users created via register-company where the trigger may have run
-- before the user_roles insert completed successfully.

INSERT INTO public.user_roles (user_id, role)
SELECT
  p.id,
  COALESCE(
    (au.raw_user_meta_data ->> 'role')::public.app_role,
    'agent'
  )
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
)
ON CONFLICT (user_id, role) DO NOTHING;
