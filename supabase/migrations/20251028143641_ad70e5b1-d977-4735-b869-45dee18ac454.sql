-- Permitir que médicos jefe vean información básica de otros médicos
CREATE POLICY "Medicos jefe can view other medicos basic info"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'medico_jefe'::app_role) 
  AND (role = 'medico'::app_role OR role = 'medico_jefe'::app_role)
);