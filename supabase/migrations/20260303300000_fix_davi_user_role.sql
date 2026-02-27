-- Fix: davi.costa@grupoall.in (e01bd8f6-a9c4-432c-9715-c1b39cf22491) is missing from user_roles.
-- The user appears as Admin in the UI but has no entry in user_roles table.
-- This migration inserts the missing admin role entry.

INSERT INTO public.user_roles (user_id, role)
VALUES ('e01bd8f6-a9c4-432c-9715-c1b39cf22491', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
