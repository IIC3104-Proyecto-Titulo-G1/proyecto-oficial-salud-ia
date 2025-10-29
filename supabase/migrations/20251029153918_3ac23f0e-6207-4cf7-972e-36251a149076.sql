-- Permitir a médicos jefe eliminar casos
CREATE POLICY "Medicos jefe can delete cases"
ON public.casos
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'medico_jefe'::app_role));

-- Permitir eliminar sugerencias IA de casos que el médico jefe puede ver
CREATE POLICY "Medicos jefe can delete AI suggestions"
ON public.sugerencia_ia
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.casos
    WHERE casos.id = sugerencia_ia.caso_id
    AND has_role(auth.uid(), 'medico_jefe'::app_role)
  )
);

-- Permitir eliminar comunicaciones de casos que el médico jefe puede ver
CREATE POLICY "Medicos jefe can delete patient communications"
ON public.comunicaciones_paciente
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.casos
    WHERE casos.id = comunicaciones_paciente.caso_id
    AND has_role(auth.uid(), 'medico_jefe'::app_role)
  )
);

-- Permitir eliminar resoluciones de casos que el médico jefe puede ver
CREATE POLICY "Medicos jefe can delete case resolutions"
ON public.resolucion_caso
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.casos
    WHERE casos.id = resolucion_caso.caso_id
    AND has_role(auth.uid(), 'medico_jefe'::app_role)
  )
);