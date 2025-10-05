-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can insert case resolutions" ON public.resolucion_caso;

-- Create a new policy that allows users who own the case to insert resolutions
CREATE POLICY "Case owners can insert resolutions" ON public.resolucion_caso
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.casos
    WHERE casos.id = caso_id
    AND (casos.medico_tratante_id = auth.uid() OR casos.medico_jefe_id = auth.uid())
  )
);