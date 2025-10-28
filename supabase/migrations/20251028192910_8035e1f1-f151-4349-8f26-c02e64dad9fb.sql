-- Actualizar el trigger para usar terminología de ley
CREATE OR REPLACE FUNCTION public.notify_medico_on_case_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  medico_jefe_name TEXT;
BEGIN
  -- Solo proceder si el estado cambió a 'aceptado' o 'rechazado'
  IF (NEW.estado IN ('aceptado', 'rechazado')) 
     AND (OLD.estado IS NULL OR OLD.estado NOT IN ('aceptado', 'rechazado'))
     AND NEW.medico_jefe_id IS NOT NULL 
     AND NEW.medico_tratante_id IS NOT NULL
     AND NEW.medico_jefe_id != NEW.medico_tratante_id THEN
    
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
      CASE 
        WHEN NEW.estado = 'aceptado' THEN 'Ley aplicada'
        ELSE 'Ley no aplicada'
      END,
      CASE
        WHEN NEW.estado = 'aceptado' THEN 'Doctor(a) ' || COALESCE(medico_jefe_name, 'Desconocido') || ' ha aplicado la ley de urgencia al caso del paciente ' || NEW.nombre_paciente
        ELSE 'Doctor(a) ' || COALESCE(medico_jefe_name, 'Desconocido') || ' ha determinado que no aplica la ley de urgencia al caso del paciente ' || NEW.nombre_paciente
      END,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$function$;