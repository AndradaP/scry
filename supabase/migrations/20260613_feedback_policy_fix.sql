DROP POLICY "Users can manage their own feedback" ON public.teardown_feedback;

CREATE POLICY "Users can manage their own feedback"
ON public.teardown_feedback
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
