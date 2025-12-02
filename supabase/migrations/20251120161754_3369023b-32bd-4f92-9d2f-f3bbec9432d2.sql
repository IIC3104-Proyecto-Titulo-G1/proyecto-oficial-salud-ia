-- Crear función auxiliar para obtener el prefijo del doctor según el género
CREATE OR REPLACE FUNCTION public.get_doctor_prefix(p_genero TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_genero
    WHEN 'masculino' THEN RETURN 'Dr.';
    WHEN 'femenino' THEN RETURN 'Dra.';
    ELSE RETURN 'Dr(a).';
  END CASE;
END;
$$;

-- Actualizar función de notificación cuando se deriva un caso
CREATE OR REPLACE FUNCTION public.notify_medicos_jefe_on_derivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  medico_jefe_record RECORD;
  medico_name TEXT;
  medico_genero TEXT;
  doctor_prefix TEXT;
BEGIN
  -- Solo proceder si el estado cambió a 'derivado'
  IF NEW.estado = 'derivado' AND (OLD.estado IS NULL OR OLD.estado != 'derivado') THEN
    -- Obtener el nombre y género del médico que derivó el caso
    SELECT nombre, genero INTO medico_name, medico_genero
    FROM user_roles
    WHERE user_id = NEW.medico_tratante_id;
    
    -- Obtener el prefijo correcto
    doctor_prefix := get_doctor_prefix(medico_genero);
    
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
        'caso_derivado',
        'Nuevo caso derivado',
        doctor_prefix || ' ' || COALESCE(medico_name, 'Desconocido') || ' ha derivado el caso del paciente ' || NEW.nombre_paciente,
        false
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Actualizar función de notificación cuando se resuelve un caso
CREATE OR REPLACE FUNCTION public.notify_medico_on_case_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  medico_jefe_name TEXT;
  medico_jefe_genero TEXT;
  doctor_prefix TEXT;
BEGIN
  -- Solo proceder si el estado cambió a 'aceptado' o 'rechazado'
  IF (NEW.estado IN ('aceptado', 'rechazado')) 
     AND (OLD.estado IS NULL OR OLD.estado NOT IN ('aceptado', 'rechazado'))
     AND NEW.medico_jefe_id IS NOT NULL 
     AND NEW.medico_tratante_id IS NOT NULL
     AND NEW.medico_jefe_id != NEW.medico_tratante_id THEN
    
    -- Obtener el nombre y género del médico jefe que resolvió el caso
    SELECT nombre, genero INTO medico_jefe_name, medico_jefe_genero
    FROM user_roles
    WHERE user_id = NEW.medico_jefe_id;
    
    -- Obtener el prefijo correcto
    doctor_prefix := get_doctor_prefix(medico_jefe_genero);
    
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
        WHEN NEW.estado = 'aceptado' THEN doctor_prefix || ' ' || COALESCE(medico_jefe_name, 'Desconocido') || ' ha aplicado la ley de urgencia al caso del paciente ' || NEW.nombre_paciente
        ELSE doctor_prefix || ' ' || COALESCE(medico_jefe_name, 'Desconocido') || ' ha determinado que no aplica la ley de urgencia al caso del paciente ' || NEW.nombre_paciente
      END,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$function$;