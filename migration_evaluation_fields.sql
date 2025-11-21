-- Migración para agregar campos de evaluación clínica a la tabla casos
-- Todos los campos son nullable para no afectar datos existentes

ALTER TABLE public.casos
ADD COLUMN IF NOT EXISTS episodio VARCHAR(255),
ADD COLUMN IF NOT EXISTS centro VARCHAR(255),
ADD COLUMN IF NOT EXISTS fecha_ingreso TIMESTAMP,

-- Signos vitales extendidos
ADD COLUMN IF NOT EXISTS pa_sistolica INTEGER,
ADD COLUMN IF NOT EXISTS pa_diastolica INTEGER,
ADD COLUMN IF NOT EXISTS pa_media INTEGER,
ADD COLUMN IF NOT EXISTS fc INTEGER,
ADD COLUMN IF NOT EXISTS fr INTEGER,
ADD COLUMN IF NOT EXISTS temperatura_c DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS sat_o2 INTEGER,
ADD COLUMN IF NOT EXISTS glasgow INTEGER,

-- Soporte respiratorio
ADD COLUMN IF NOT EXISTS fio2 INTEGER,
ADD COLUMN IF NOT EXISTS fio2_ge_50 BOOLEAN,
ADD COLUMN IF NOT EXISTS vm BOOLEAN,

-- Antecedentes médicos
ADD COLUMN IF NOT EXISTS antecedentes_cardiacos BOOLEAN,
ADD COLUMN IF NOT EXISTS antecedentes_diabeticos BOOLEAN,
ADD COLUMN IF NOT EXISTS antecedentes_hta BOOLEAN,

-- Laboratorio
ADD COLUMN IF NOT EXISTS hb DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS creatinina DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS bun DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS sodio DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS potasio DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS troponinas_alteradas BOOLEAN,

-- Evaluaciones clínicas
ADD COLUMN IF NOT EXISTS triage VARCHAR(50),
ADD COLUMN IF NOT EXISTS tipo_cama VARCHAR(100),
ADD COLUMN IF NOT EXISTS ecg_alterado BOOLEAN,
ADD COLUMN IF NOT EXISTS dreo BOOLEAN,
ADD COLUMN IF NOT EXISTS dva BOOLEAN,
ADD COLUMN IF NOT EXISTS compromiso_conciencia BOOLEAN,
ADD COLUMN IF NOT EXISTS rnm_protocol_stroke BOOLEAN,

-- Procedimientos
ADD COLUMN IF NOT EXISTS pcr BOOLEAN,
ADD COLUMN IF NOT EXISTS cirugia BOOLEAN,
ADD COLUMN IF NOT EXISTS cirugia_same_day BOOLEAN,
ADD COLUMN IF NOT EXISTS hemodinamia BOOLEAN,
ADD COLUMN IF NOT EXISTS hemodinamia_same_day BOOLEAN,
ADD COLUMN IF NOT EXISTS endoscopia BOOLEAN,
ADD COLUMN IF NOT EXISTS endoscopia_same_day BOOLEAN,
ADD COLUMN IF NOT EXISTS dialisis BOOLEAN,
ADD COLUMN IF NOT EXISTS trombolisis BOOLEAN,
ADD COLUMN IF NOT EXISTS trombolisis_same_day BOOLEAN,
ADD COLUMN IF NOT EXISTS transfusiones INTEGER;

-- Comentarios sobre los campos agregados
COMMENT ON COLUMN public.casos.episodio IS 'ID del episodio médico';
COMMENT ON COLUMN public.casos.centro IS 'Centro hospitalario';
COMMENT ON COLUMN public.casos.fecha_ingreso IS 'Fecha de ingreso del paciente';
COMMENT ON COLUMN public.casos.pa_sistolica IS 'Presión arterial sistólica (mmHg)';
COMMENT ON COLUMN public.casos.pa_diastolica IS 'Presión arterial diastólica (mmHg)';
COMMENT ON COLUMN public.casos.pa_media IS 'Presión arterial media (mmHg) - calculado automáticamente';
COMMENT ON COLUMN public.casos.fc IS 'Frecuencia cardíaca (lpm)';
COMMENT ON COLUMN public.casos.fr IS 'Frecuencia respiratoria (rpm)';
COMMENT ON COLUMN public.casos.temperatura_c IS 'Temperatura corporal (°C)';
COMMENT ON COLUMN public.casos.sat_o2 IS 'Saturación de oxígeno (%)';
COMMENT ON COLUMN public.casos.glasgow IS 'Escala de Glasgow (3-15)';
COMMENT ON COLUMN public.casos.fio2 IS 'Fracción inspirada de oxígeno (%)';
COMMENT ON COLUMN public.casos.fio2_ge_50 IS 'FiO2 >= 50%';
COMMENT ON COLUMN public.casos.vm IS 'Ventilación mecánica';
COMMENT ON COLUMN public.casos.antecedentes_cardiacos IS 'Cardiopatía previa';
COMMENT ON COLUMN public.casos.antecedentes_diabeticos IS 'Diabetes mellitus';
COMMENT ON COLUMN public.casos.antecedentes_hta IS 'Hipertensión arterial';
COMMENT ON COLUMN public.casos.hb IS 'Hemoglobina (g/dL)';
COMMENT ON COLUMN public.casos.creatinina IS 'Creatinina (mg/dL)';
COMMENT ON COLUMN public.casos.bun IS 'Nitrógeno ureico (mg/dL)';
COMMENT ON COLUMN public.casos.sodio IS 'Sodio sérico (mEq/L)';
COMMENT ON COLUMN public.casos.potasio IS 'Potasio sérico (mEq/L)';
COMMENT ON COLUMN public.casos.troponinas_alteradas IS 'Troponinas cardíacas alteradas';
COMMENT ON COLUMN public.casos.triage IS 'Nivel de triage';
COMMENT ON COLUMN public.casos.tipo_cama IS 'Tipo de cama asignada';
COMMENT ON COLUMN public.casos.ecg_alterado IS 'ECG con alteraciones';
COMMENT ON COLUMN public.casos.dreo IS 'Drogas vasoactivas';
COMMENT ON COLUMN public.casos.dva IS 'Drogas vasoactivas específicas';
COMMENT ON COLUMN public.casos.compromiso_conciencia IS 'Alteración de conciencia';
COMMENT ON COLUMN public.casos.rnm_protocol_stroke IS 'Protocolo RNM stroke';
COMMENT ON COLUMN public.casos.pcr IS 'Parada cardiorrespiratoria';
COMMENT ON COLUMN public.casos.cirugia IS 'Cirugía realizada';
COMMENT ON COLUMN public.casos.cirugia_same_day IS 'Cirugía el mismo día';
COMMENT ON COLUMN public.casos.hemodinamia IS 'Hemodinamia';
COMMENT ON COLUMN public.casos.hemodinamia_same_day IS 'Hemodinamia el mismo día';
COMMENT ON COLUMN public.casos.endoscopia IS 'Endoscopia';
COMMENT ON COLUMN public.casos.endoscopia_same_day IS 'Endoscopia el mismo día';
COMMENT ON COLUMN public.casos.dialisis IS 'Diálisis';
COMMENT ON COLUMN public.casos.trombolisis IS 'Trombólisis';
COMMENT ON COLUMN public.casos.trombolisis_same_day IS 'Trombólisis el mismo día';
COMMENT ON COLUMN public.casos.transfusiones IS 'Número de transfusiones';