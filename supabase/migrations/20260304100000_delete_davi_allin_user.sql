-- Delete user davi@allin.com and all related data
-- Find user id first
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'davi@allin.com' LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Delete from profiles and related tables (cascade should handle most)
    DELETE FROM public.profiles WHERE id = v_user_id;

    -- Delete auth user
    DELETE FROM auth.users WHERE id = v_user_id;

    RAISE NOTICE 'Deleted user davi@allin.com (id: %)', v_user_id;
  ELSE
    RAISE NOTICE 'User davi@allin.com not found';
  END IF;
END;
$$;
