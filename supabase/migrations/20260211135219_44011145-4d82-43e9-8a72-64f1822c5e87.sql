-- Allow admins to update their company
CREATE POLICY "Admins can update company"
ON public.companies
FOR UPDATE
USING (id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (id = get_user_company_id() AND has_role(auth.uid(), 'admin'::app_role));