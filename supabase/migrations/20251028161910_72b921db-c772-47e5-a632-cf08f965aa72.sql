-- Crear función para notificar al médico tratante cuando un médico jefe resuelve el caso
CREATE OR REPLACE FUNCTION public.notify_medico_on_case_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  medico_jefe_name TEXT;
BEGIN
  -- Solo proceder si el estado cambió a 'aceptado' o 'rechazado' y hay un médico jefe asignado
  IF (NEW.estado IN ('aceptado', 'rechazado')) 
     AND (OLD.estado IS NULL OR OLD.estado NOT IN ('aceptado', 'rechazado'))
     AND NEW.medico_jefe_id IS NOT NULL 
     AND NEW.medico_tratante_id IS NOT NULL THEN
    
    -- Obtener el nombre del médico jefe que resolvió el caso
    SELECT nombre INTO medico_jefe_name
    FROM user_roles
    WHERE user_id = NEW.medico_jefe_id;
    
    -- Crear notificación para el médico tratante
    INSERT INTO notificaciones (
      usuario_id,
      caso_id,
      tipo,
      titulo,
      mensaje,
      leido
    ) VALUES (
      NEW.medico_tratante_id,
      NEW.id,
      'caso_resuelto',
      'Caso resuelto',
      'Doctor(a) ' || COALESCE(medico_jefe_name, 'Desconocido') || ' ha resuelto el caso del paciente ' || NEW.nombre_paciente,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para notificar al médico tratante cuando se resuelve un caso
CREATE TRIGGER notify_medico_on_resolution
  AFTER UPDATE ON public.casos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_medico_on_case_resolution();