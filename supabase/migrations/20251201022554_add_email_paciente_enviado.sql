-- Agregar campo para guardar el email del paciente usado en el último envío
ALTER TABLE public.resolucion_caso
ADD COLUMN IF NOT EXISTS email_paciente_enviado VARCHAR(255);

