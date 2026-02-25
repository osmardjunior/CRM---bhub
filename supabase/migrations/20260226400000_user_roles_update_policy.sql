-- Add UPDATE policy for user_roles so admins can change roles directly
-- (frontend uses delete+insert as workaround, but this covers direct API use)
CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
