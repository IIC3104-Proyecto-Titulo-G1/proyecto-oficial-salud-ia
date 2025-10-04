-- Insertar casos ficticios para demostración
-- Primero obtenemos el ID de un usuario existente
DO $$
DECLARE
  user_id_var UUID;
BEGIN
  -- Obtener el primer usuario disponible
  SELECT id INTO user_id_var FROM auth.users LIMIT 1;

  -- Insertar casos ficticios
  INSERT INTO casos (
    nombre_paciente, edad_paciente, sexo_paciente, email_paciente,
    diagnostico_principal, sintomas, historia_clinica, descripcion_adicional,
    presion_arterial, frecuencia_cardiaca, temperatura, saturacion_oxigeno, frecuencia_respiratoria,
    medico_tratante_id, estado, fecha_creacion
  ) VALUES
    (
      'María González Pérez', 68, 'F', 'maria.gonzalez@email.cl',
      'Infarto Agudo al Miocardio', 
      'Dolor precordial intenso, irradiado a brazo izquierdo, disnea, sudoración profusa',
      'Hipertensa en tratamiento, diabética tipo 2',
      'Paciente ingresa a urgencias con dolor torácico de 2 horas de evolución',
      '180/110', 115, 36.8, 92, 24,
      user_id_var, 'pendiente', NOW() - INTERVAL '2 hours'
    ),
    (
      'Carlos Martínez Rojas', 45, 'M', 'carlos.martinez@email.cl',
      'Trauma Craneoencefálico Severo',
      'Pérdida de conciencia, confusión, cefalea intensa, vómitos',
      'Sin antecedentes mórbidos conocidos',
      'Caída desde 3 metros de altura, GCS 12 al ingreso',
      '140/90', 88, 37.2, 95, 18,
      user_id_var, 'aceptado', NOW() - INTERVAL '5 hours'
    ),
    (
      'Ana Silva Torres', 32, 'F', 'ana.silva@email.cl',
      'Apendicitis Aguda',
      'Dolor abdominal en fosa ilíaca derecha, náuseas, fiebre',
      'Sin antecedentes',
      'Dolor migratorio desde epigastrio, signo de Blumberg positivo',
      '120/75', 95, 38.2, 98, 20,
      user_id_var, 'derivado', NOW() - INTERVAL '1 day'
    ),
    (
      'Pedro Ramírez Castro', 72, 'M', 'pedro.ramirez@email.cl',
      'Accidente Cerebrovascular Isquémico',
      'Hemiparesia derecha súbita, disartria, desviación de comisura labial',
      'Hipertenso, fibrilación auricular',
      'Sintomatología iniciada hace 90 minutos',
      '190/100', 98, 36.5, 96, 16,
      user_id_var, 'pendiente', NOW() - INTERVAL '30 minutes'
    ),
    (
      'Sofía Vargas Morales', 28, 'F', 'sofia.vargas@email.cl',
      'Crisis Asmática Severa',
      'Disnea severa, sibilancias, uso de musculatura accesoria',
      'Asma bronquial desde la infancia, no adherente a tratamiento',
      'Cuadro iniciado hace 3 horas, sin mejoría con salbutamol',
      '130/85', 125, 37.0, 88, 32,
      user_id_var, 'pendiente', NOW() - INTERVAL '3 hours'
    ),
    (
      'Juan López Fernández', 55, 'M', 'juan.lopez@email.cl',
      'Hemorragia Digestiva Alta',
      'Hematemesis, melena, mareos, palidez',
      'Cirrosis hepática, várices esofágicas conocidas',
      'Vómitos con sangre fresca en 3 ocasiones',
      '90/60', 110, 36.2, 94, 22,
      user_id_var, 'aceptado', NOW() - INTERVAL '6 hours'
    ),
    (
      'Carmen Soto Díaz', 40, 'F', 'carmen.soto@email.cl',
      'Cefalea Primaria - Migraña',
      'Cefalea hemicraneal pulsátil, fotofobia, náuseas',
      'Migrañas recurrentes, usuaria de anticonceptivos',
      'Cefalea habitual, sin signos de alarma',
      '125/80', 78, 36.6, 99, 16,
      user_id_var, 'rechazado', NOW() - INTERVAL '4 hours'
    );

  -- Insertar sugerencias de IA para cada caso
  INSERT INTO sugerencia_ia (caso_id, sugerencia, confianza, explicacion)
  SELECT 
    c.id,
    CASE 
      WHEN c.nombre_paciente = 'María González Pérez' THEN 'aceptar'::sugerencia_tipo
      WHEN c.nombre_paciente = 'Carlos Martínez Rojas' THEN 'aceptar'::sugerencia_tipo
      WHEN c.nombre_paciente = 'Ana Silva Torres' THEN 'incierto'::sugerencia_tipo
      WHEN c.nombre_paciente = 'Pedro Ramírez Castro' THEN 'aceptar'::sugerencia_tipo
      WHEN c.nombre_paciente = 'Sofía Vargas Morales' THEN 'aceptar'::sugerencia_tipo
      WHEN c.nombre_paciente = 'Juan López Fernández' THEN 'aceptar'::sugerencia_tipo
      ELSE 'rechazar'::sugerencia_tipo
    END,
    CASE 
      WHEN c.nombre_paciente = 'María González Pérez' THEN 95
      WHEN c.nombre_paciente = 'Carlos Martínez Rojas' THEN 92
      WHEN c.nombre_paciente = 'Ana Silva Torres' THEN 65
      WHEN c.nombre_paciente = 'Pedro Ramírez Castro' THEN 98
      WHEN c.nombre_paciente = 'Sofía Vargas Morales' THEN 88
      WHEN c.nombre_paciente = 'Juan López Fernández' THEN 94
      ELSE 75
    END,
    CASE 
      WHEN c.nombre_paciente = 'María González Pérez' THEN 
        'Criterios activados: RIESGO VITAL INMEDIATO. Variables clínicas clave: Dolor precordial característico de IAM, alteración hemodinámica (PA 180/110, FC 115), hipoxemia (SpO2 92%). Según Decreto 34, Art. 4: "Condición que pone en riesgo vital inmediato". Recomendación: ACTIVAR Ley de Urgencia.'
      WHEN c.nombre_paciente = 'Carlos Martínez Rojas' THEN
        'Criterios activados: RIESGO DE SECUELA FUNCIONAL GRAVE. Variables clínicas: TCE severo con alteración de conciencia (GCS 12), mecanismo de alta energía. Decreto 34, Art. 5: "Lesión con riesgo de secuela funcional grave". Recomendación: ACTIVAR Ley de Urgencia.'
      WHEN c.nombre_paciente = 'Ana Silva Torres' THEN
        'Criterios evaluados: Cuadro agudo abdominal con signos inflamatorios. Signos vitales relativamente estables. La apendicitis aguda puede requerir cirugía urgente, pero no presenta descompensación actual. Requiere evaluación por médico jefe para decisión final.'
      WHEN c.nombre_paciente = 'Pedro Ramírez Castro' THEN
        'Criterios activados: RIESGO VITAL Y SECUELA FUNCIONAL GRAVE. Variables clínicas: Evento cerebrovascular agudo (<3 horas), déficit neurológico focal, alteración hemodinámica severa (PA 190/100). Decreto 34: "Condición neurológica aguda con riesgo vital". Ventana terapéutica para trombólisis. Recomendación: ACTIVAR Ley de Urgencia INMEDIATAMENTE.'
      WHEN c.nombre_paciente = 'Sofía Vargas Morales' THEN
        'Criterios activados: INSUFICIENCIA RESPIRATORIA AGUDA. Variables clínicas: Crisis asmática severa, hipoxemia significativa (SpO2 88%), taquicardia compensatoria (FC 125), taquipnea (FR 32). Decreto 34, Art. 6: "Insuficiencia respiratoria aguda". Recomendación: ACTIVAR Ley de Urgencia.'
      WHEN c.nombre_paciente = 'Juan López Fernández' THEN
        'Criterios activados: HEMORRAGIA ACTIVA CON SHOCK. Variables clínicas: Hematemesis masiva, signos de shock hipovolémico (PA 90/60, FC 110), antecedente de várices esofágicas. Decreto 34: "Hemorragia activa con compromiso hemodinámico". Recomendación: ACTIVAR Ley de Urgencia.'
      ELSE
        'Criterios evaluados: Cefalea primaria sin signos de alarma. Signos vitales normales, sin alteración del estado de conciencia. No cumple criterios de urgencia vital según Decreto 34. Cuadro manejable en atención ambulatoria. Recomendación: NO activar Ley de Urgencia.'
    END
  FROM casos c
  WHERE c.medico_tratante_id = user_id_var
  AND NOT EXISTS (
    SELECT 1 FROM sugerencia_ia s WHERE s.caso_id = c.id
  );

END $$;