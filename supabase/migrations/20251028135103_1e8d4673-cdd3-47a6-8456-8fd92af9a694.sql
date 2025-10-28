-- Función para enviar notificaciones cuando se deriva un caso
CREATE OR REPLACE FUNCTION public.notify_medicos_jefe_on_derivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  medico_jefe_record RECORD;
  medico_name TEXT;
BEGIN
  -- Solo proceder si el estado cambió a 'derivado'
  IF NEW.estado = 'derivado' AND (OLD.estado IS NULL OR OLD.estado != 'derivado') THEN
    -- Obtener el nombre del médico que derivó el caso
    SELECT nombre INTO medico_name
    FROM user_roles
    WHERE user_id = NEW.medico_tratante_id;
    
    -- Crear notificaciones para todos los médicos jefe
    FOR medico_jefe_record IN 
      SELECT user_id 
      FROM user_roles 
      WHERE role = 'medico_jefe'
    LOOP
      INSERT INTO notificaciones (
        usuario_id,
        caso_id,
        tipo,
        titulo,
        mensaje,
        leido
      ) VALUES (
        medico_jefe_record.user_id,
        NEW.id,
        'derivacion',
        'Nuevo caso derivado',
        'Doctor(a) ' || COALESCE(medico_name, 'Desconocido') || ' ha derivado el caso del paciente ' || NEW.nombre_paciente,
        false
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear el trigger que ejecuta la función cuando se actualiza un caso
DROP TRIGGER IF EXISTS trigger_notify_derivacion ON casos;
CREATE TRIGGER trigger_notify_derivacion
  AFTER INSERT OR UPDATE ON casos
  FOR EACH ROW
  EXECUTE FUNCTION notify_medicos_jefe_on_derivation();