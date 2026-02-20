-- Allow users to delete contact_funnel_stages for their company
CREATE POLICY "Users can delete company contact_funnel_stages"
ON public.contact_funnel_stages
FOR DELETE
USING (company_id = get_user_company_id());