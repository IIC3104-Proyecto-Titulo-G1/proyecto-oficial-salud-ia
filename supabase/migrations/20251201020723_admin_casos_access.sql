-- Agregar políticas RLS para que los admins puedan ver y actualizar todos los casos

-- Política para que admins puedan ver todos los casos
CREATE POLICY "Admins can view all cases"
  ON public.casos FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Política para que admins puedan actualizar casos (especialmente estado_resolucion_aseguradora)
CREATE POLICY "Admins can update cases"
  ON public.casos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Política para que admins puedan ver todas las resoluciones de casos
CREATE POLICY "Admins can view all case resolutions"
  ON public.resolucion_caso FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Política para que admins puedan ver todas las sugerencias de IA
CREATE POLICY "Admins can view all AI suggestions"
  ON public.sugerencia_ia FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Política para que admins puedan ver todas las comunicaciones de pacientes
CREATE POLICY "Admins can view all patient communications"
  ON public.comunicaciones_paciente FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Política para que admins puedan insertar comunicaciones de pacientes
CREATE POLICY "Admins can insert patient communications"
  ON public.comunicaciones_paciente FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

