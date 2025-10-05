-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert patient communications" ON public.comunicaciones_paciente;

-- Create a new policy that allows users who own the case to insert communications
CREATE POLICY "Case owners can insert patient communications" ON public.comunicaciones_paciente
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.casos
    WHERE casos.id = caso_id
    AND (casos.medico_tratante_id = auth.uid() OR casos.medico_jefe_id = auth.uid())
  )
);