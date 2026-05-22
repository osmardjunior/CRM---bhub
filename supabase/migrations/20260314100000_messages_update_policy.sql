-- Allow authenticated users to update messages in their company (edit body, soft-delete)
CREATE POLICY "Users can update company messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id());
