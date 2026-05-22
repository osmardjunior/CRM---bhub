-- Allow users to update their own annotations
CREATE POLICY "Users can update own annotations"
ON public.annotations FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- Allow users to delete their own annotations
CREATE POLICY "Users can delete own annotations"
ON public.annotations FOR DELETE TO authenticated
USING (author_id = auth.uid());
