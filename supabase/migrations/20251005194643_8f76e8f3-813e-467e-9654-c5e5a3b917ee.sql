-- Agregar política RLS para que usuarios puedan actualizar su propio perfil (excepto rol)
CREATE POLICY "Users can update their own profile (except role)"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND role = (SELECT role FROM public.user_roles WHERE user_id = auth.uid())
);