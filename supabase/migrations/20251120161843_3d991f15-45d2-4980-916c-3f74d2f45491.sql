-- Actualizar la función get_doctor_prefix para establecer search_path
CREATE OR REPLACE FUNCTION public.get_doctor_prefix(p_genero TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  CASE p_genero
    WHEN 'masculino' THEN RETURN 'Dr.';
    WHEN 'femenino' THEN RETURN 'Dra.';
    ELSE RETURN 'Dr(a).';
  END CASE;
END;
$$;